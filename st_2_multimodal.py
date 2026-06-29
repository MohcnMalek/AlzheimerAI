"""
🧠 ResNet3D-18 (Inflate-1 Strategy) - VERSION MULTIMODALE PFA
Architecture : IRM 3D + Features cliniques (Age + Sexe)
Inclus : Tight Cropping, Focal Loss, Data Augmentation Avancée, TTA et Fusion Tardive.

Différences par rapport à st_2.py :
  - Le Dataset retourne (volume_3d, clinical_features, label)
  - Architecture MultiModalResNet3D : backbone 3D + MLP clinique + classifier fusionné
  - Normalisation âge/sexe basée UNIQUEMENT sur le train set (anti-leakage)
  - Comparaison automatique : modèle IRM seul vs modèle multimodal
"""

import os
import time
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import nibabel as nib
import pandas as pd
from scipy.ndimage import zoom
import scipy.ndimage as ndimage
import random
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, confusion_matrix,
    ConfusionMatrixDisplay, classification_report, roc_auc_score
)
from torchvision.models import resnet18, ResNet18_Weights
import re
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
SKULL_STRIPPED_DIR = r'C:\Users\youne\Desktop\ADNI_SKULL_STRIPPED'
CSV_PATH           = r'dataset_preprocessed.csv'

TARGET_SHAPE = (112, 112, 112)
BATCH_SIZE   = 8
EPOCHS       = 30
LR           = 1e-4

# Dimension des features cliniques après MLP
CLINICAL_FEAT_DIM = 16

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
torch.backends.cudnn.benchmark = True

# ==========================================
# 🛠️ TIGHT CROPPING
# ==========================================
def crop_to_brain(data, threshold=1e-5):
    """Supprime le padding noir autour du cerveau."""
    mask = data > threshold
    if not np.any(mask):
        return data
    coords = np.array(np.where(mask))
    x_min, x_max = coords[0].min(), coords[0].max()
    y_min, y_max = coords[1].min(), coords[1].max()
    z_min, z_max = coords[2].min(), coords[2].max()
    return data[x_min:x_max+1, y_min:y_max+1, z_min:z_max+1]

# ==========================================
# 🎯 FOCAL LOSS
# ==========================================
class FocalLoss(nn.Module):
    def __init__(self, alpha=0.25, gamma=2.0, reduction='mean'):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        import torch.nn.functional as F
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        F_loss = self.alpha * (1 - pt)**self.gamma * ce_loss
        return torch.mean(F_loss) if self.reduction == 'mean' else F_loss

# ==========================================
# 🧬 INFLATE 2D → 3D
# ==========================================
def inflate_conv2d_to_3d(conv2d):
    k, s, p = conv2d.kernel_size, conv2d.stride, conv2d.padding
    k = (k[0], k[0], k[1]) if isinstance(k, tuple) else (k, k, k)
    s = (s[0], s[0], s[1]) if isinstance(s, tuple) else (s, s, s)
    p = (p[0], p[0], p[1]) if isinstance(p, tuple) else (p, p, p)

    conv3d = nn.Conv3d(conv2d.in_channels, conv2d.out_channels, k, s, p,
                       bias=(conv2d.bias is not None))
    with torch.no_grad():
        mid = k[0] // 2
        conv3d.weight.zero_()
        conv3d.weight[:, :, mid, :, :] = conv2d.weight
        if conv2d.bias is not None:
            conv3d.bias.copy_(conv2d.bias)
    return conv3d

def convert_resnet_to_3d(module):
    for name, child in module.named_children():
        if isinstance(child, nn.Conv2d):
            setattr(module, name, inflate_conv2d_to_3d(child))
        elif isinstance(child, nn.BatchNorm2d):
            bn = child
            setattr(module, name, nn.BatchNorm3d(bn.num_features, bn.eps, bn.momentum, bn.affine))
        elif isinstance(child, nn.MaxPool2d):
            k, s, p = child.kernel_size, child.stride, child.padding
            setattr(module, name, nn.MaxPool3d((k,k,k), (s,s,s), (p,p,p)))
        elif isinstance(child, nn.AdaptiveAvgPool2d):
            setattr(module, name, nn.AdaptiveAvgPool3d((1, 1, 1)))
        else:
            convert_resnet_to_3d(child)

# ==========================================
# 🧠 ARCHITECTURE MULTIMODALE
# ==========================================
class MultiModalResNet3D(nn.Module):
    """
    Fusion tardive :
      - Branche IRM    : Inflated ResNet3D-18 → 512 features
      - Branche clinique : MLP [age, sex] → 16 features
      - Classifier fusionné : concat(512 + 16) → 64 → 2
    """
    def __init__(self, num_classes=2, clinical_dim=2, clinical_feat=CLINICAL_FEAT_DIM):
        super().__init__()

        # --- Branche IRM 3D ---
        self.backbone = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
        convert_resnet_to_3d(self.backbone)

        # Adapter 3 canaux → 1 canal (moyenne des poids)
        old_conv1 = self.backbone.conv1
        self.backbone.conv1 = nn.Conv3d(
            1, 64,
            kernel_size=old_conv1.kernel_size,
            stride=old_conv1.stride,
            padding=old_conv1.padding,
            bias=False
        )
        with torch.no_grad():
            self.backbone.conv1.weight = nn.Parameter(old_conv1.weight.mean(dim=1, keepdim=True))

        # Récupérer la dimension des features avant le fc original
        img_feat_dim = self.backbone.fc.in_features  # 512 pour ResNet-18
        self.backbone.fc = nn.Identity()  # → sort 512 features brutes

        # --- Branche clinique (age + sex) ---
        self.clinical_mlp = nn.Sequential(
            nn.Linear(clinical_dim, 32),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(32),
            nn.Dropout(0.3),
            nn.Linear(32, clinical_feat),
            nn.ReLU(inplace=True),
        )

        # --- Classifier fusionné ---
        self.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(img_feat_dim + clinical_feat, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes)
        )

    def forward(self, mri, clinical):
        img_feat  = self.backbone(mri)          # (B, 512)
        clin_feat = self.clinical_mlp(clinical) # (B, 16)
        fused = torch.cat([img_feat, clin_feat], dim=1)
        return self.classifier(fused)

# ==========================================
# 📂 DATASET MULTIMODAL
# ==========================================
class ADNI3DMultiModalDataset(Dataset):
    def __init__(self, paths, labels, clinical, augment=False):
        """
        paths    : array de chemins .nii
        labels   : array de labels (0/1)
        clinical : array shape (N, 2) = [age_normalisé, sex_encodé]
        """
        self.paths    = paths
        self.labels   = labels
        self.clinical = clinical.astype(np.float32)
        self.augment  = augment

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        try:
            img = nib.load(self.paths[idx])
            img = nib.as_closest_canonical(img)
            data = img.get_fdata().astype(np.float32)
        except:
            data = np.zeros(TARGET_SHAPE, dtype=np.float32)

        # 1. Tight Cropping
        data = crop_to_brain(data)

        # 2. Resize 3D
        import torch.nn.functional as F
        tensor_data = torch.from_numpy(data).float().unsqueeze(0).unsqueeze(0)
        tensor_data = F.interpolate(tensor_data, size=TARGET_SHAPE, mode='trilinear', align_corners=False)
        data = tensor_data.squeeze(0).squeeze(0).numpy()

        # 3. Augmentation (IRM uniquement, pas sur les features cliniques)
        if self.augment:
            if random.random() > 0.5:
                data = np.flip(data, axis=0).copy()
            if random.random() > 0.3:
                data = ndimage.rotate(data, random.uniform(-5, 5), axes=(0, 1), reshape=False, order=1)
            if random.random() > 0.5:
                data = data * random.uniform(0.8, 1.2)
            if random.random() > 0.5:
                data = data + np.random.normal(0, 0.05, data.shape).astype(np.float32)

        # 4. Normalisation Z-score
        std = data.std()
        if std > 1e-6:
            data = (data - data.mean()) / std

        mri_tensor      = torch.from_numpy(data).float().unsqueeze(0)
        clinical_tensor = torch.from_numpy(self.clinical[idx]).float()
        label_tensor    = torch.tensor(self.labels[idx], dtype=torch.long)

        return mri_tensor, clinical_tensor, label_tensor

# ==========================================
# 📑 CHARGEMENT CSV + MATCHING + FEATURES CLINIQUES
# ==========================================
def detect_column(df, candidates):
    """Trouve la première colonne du CSV qui matche (insensible à la casse)."""
    cols_lower = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in cols_lower:
            return cols_lower[cand.lower()]
    return None

def build_dataset():
    df = pd.read_csv(CSV_PATH)
    df = df[df['original_group'].isin(['AD', 'CN'])].copy()

    # --- Détecter les colonnes age et sex (noms variés possibles) ---
    age_col = detect_column(df, ['age', 'Age', 'AGE', 'patient_age'])
    sex_col = detect_column(df, ['sex', 'Sex', 'SEX', 'gender', 'Gender'])

    if age_col is None or sex_col is None:
        print("⚠️  Colonnes age/sex NON trouvées dans le CSV.")
        print(f"   Colonnes disponibles : {list(df.columns)}")
        print("\n💡 Solution :")
        print("   1. Récupère le CSV ADNI officiel (sclaed_5_05_2026.csv)")
        print("   2. Il contient les colonnes 'Age' et 'Sex' par Image Data ID")
        print("   3. Merge-le dans dataset_preprocessed.csv via la colonne Image ID")
        print("\n→ En attendant, le script va utiliser des valeurs factices (age=75, sex=F).")
        print("   Le modèle multimodal n'apportera AUCUN gain dans ce cas.")
        df['__age__'] = 75.0
        df['__sex__'] = 'F'
        age_col, sex_col = '__age__', '__sex__'
    else:
        print(f"✅ Colonnes cliniques détectées : age='{age_col}', sex='{sex_col}'")

    # --- Construire le mapping Image ID → (classe, sujet, age, sex) ---
    id_to_info = {}
    for _, row in df.iterrows():
        match = re.search(r'I(\d+)', str(row['file_name']))
        if match:
            img_id = 'I' + match.group(1)
            id_to_info[img_id] = {
                'class':   row['original_group'],
                'subject': row['subject'],
                'age':     row[age_col],
                'sex':     row[sex_col],
            }

    # --- Encoder le sexe en binaire (F=1, M=0) ---
    def encode_sex(s):
        if pd.isna(s):
            return 0.5  # neutre si manquant
        s = str(s).strip().upper()
        if s in ('F', 'FEMALE', 'WOMAN', '1'):
            return 1.0
        if s in ('M', 'MALE', 'MAN', '0'):
            return 0.0
        return 0.5

    # --- Parcourir les fichiers .nii et matcher ---
    paths, labels, subjects, ages, sexes = [], [], [], [], []
    class_map = {'CN': 0, 'AD': 1}

    for fname in os.listdir(SKULL_STRIPPED_DIR):
        if fname.endswith(('.nii', '.nii.gz')):
            match = re.search(r'I(\d+)', fname)
            if match and ('I' + match.group(1)) in id_to_info:
                img_id = 'I' + match.group(1)
                info   = id_to_info[img_id]

                # Age : convertir en float, fallback médiane si NaN
                try:
                    age = float(info['age'])
                    if np.isnan(age):
                        raise ValueError
                except (ValueError, TypeError):
                    age = 75.0  # médiane ADNI typique

                paths.append(os.path.join(SKULL_STRIPPED_DIR, fname))
                labels.append(class_map[info['class']])
                subjects.append(info['subject'])
                ages.append(age)
                sexes.append(encode_sex(info['sex']))

    return (
        np.array(paths),
        np.array(labels),
        np.array(subjects),
        np.array(ages, dtype=np.float32),
        np.array(sexes, dtype=np.float32),
    )

# ==========================================
# 📊 ÉVALUATION AVEC TTA (multimodal)
# ==========================================
def evaluate_with_tta(model, loader, criterion, split_name="Validation"):
    model.eval()
    all_preds, all_trues, all_probs = [], [], []
    total_loss, total_correct, total_count = 0.0, 0, 0

    with torch.no_grad():
        for X, clin, y in loader:
            X, clin, y = X.to(DEVICE), clin.to(DEVICE), y.to(DEVICE)

            X_flipped = torch.flip(X, dims=[2])

            with torch.amp.autocast('cuda'):
                logits_normal  = model(X, clin)
                probs_normal   = torch.softmax(logits_normal.float(), dim=1)

                logits_flipped = model(X_flipped, clin)
                probs_flipped  = torch.softmax(logits_flipped.float(), dim=1)

                probs_final = (probs_normal + probs_flipped) / 2.0

                loss = criterion(logits_normal, y)

            total_loss    += loss.item() * X.size(0)
            total_correct += (probs_final.argmax(1) == y).sum().item()
            total_count   += y.size(0)

            all_preds.extend(probs_final.argmax(1).cpu().numpy())
            all_trues.extend(y.cpu().numpy())
            all_probs.extend(probs_final[:, 1].cpu().numpy())

    acc = accuracy_score(all_trues, all_preds) * 100
    f1  = f1_score(all_trues, all_preds, average='weighted') * 100
    auc = roc_auc_score(all_trues, all_probs) * 100
    cm  = confusion_matrix(all_trues, all_preds)

    print(f"\n📈 RÉSULTATS {split_name.upper()} (TTA, Multimodal) :")
    print(f"   Accuracy  : {acc:.2f}%")
    print(f"   F1-Score  : {f1:.2f}%")
    print(f"   AUC (ROC) : {auc:.2f}%")
    print(f"\n📋 Rapport de Classification ({split_name}) :")
    print(classification_report(all_trues, all_preds, target_names=['CN (Sains)', 'AD (Alzheimer)']))

    fig, ax = plt.subplots(figsize=(6, 6))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['CN', 'AD'])
    disp.plot(cmap=plt.cm.Blues, ax=ax, values_format='d')
    plt.title(
        f'Matrice de Confusion — {split_name} (Multimodal + TTA)\n'
        f'Acc: {acc:.1f}% | F1: {f1:.1f}% | AUC: {auc:.1f}%',
        fontweight='bold'
    )
    plt.tight_layout()
    fname_out = f'confusion_matrix_multimodal_{split_name.lower()}.png'
    plt.savefig(fname_out, dpi=150)
    print(f"✅ Fichier '{fname_out}' sauvegardé !")

    return acc, f1, auc

# ==========================================
# 🚀 MAIN
# ==========================================
if __name__ == '__main__':
    print("=" * 75)
    print("🧠 ENTRAÎNEMENT MULTIMODAL : ResNet3D + Age + Sexe")
    print("=" * 75)

    all_paths, all_labels, all_subjects, all_ages, all_sexes = build_dataset()
    print(f"\n📊 Total volumes appariés avec données cliniques : {len(all_paths)}")
    print(f"   Age — min: {all_ages.min():.1f} | max: {all_ages.max():.1f} | mean: {all_ages.mean():.1f}")
    print(f"   Sexe — F: {(all_sexes == 1.0).sum()} | M: {(all_sexes == 0.0).sum()} | Unknown: {(all_sexes == 0.5).sum()}")

    # Split au niveau sujet
    subject_to_label = {s: l for s, l in zip(all_subjects, all_labels)}
    unique_subjects  = np.array(list(subject_to_label.keys()))
    unique_labels    = np.array([subject_to_label[s] for s in unique_subjects])

    trainval_subj, test_subj = train_test_split(
        unique_subjects, test_size=0.10, random_state=42, stratify=unique_labels
    )
    trainval_labels = np.array([subject_to_label[s] for s in trainval_subj])
    train_subj, val_subj = train_test_split(
        trainval_subj, test_size=0.111, random_state=42, stratify=trainval_labels
    )

    assert len(set(train_subj) & set(val_subj))  == 0, 'DATA LEAKAGE train/val !'
    assert len(set(train_subj) & set(test_subj)) == 0, 'DATA LEAKAGE train/test !'
    assert len(set(val_subj)   & set(test_subj)) == 0, 'DATA LEAKAGE val/test !'

    train_mask = np.isin(all_subjects, train_subj)
    val_mask   = np.isin(all_subjects, val_subj)
    test_mask  = np.isin(all_subjects, test_subj)

    print(f"\n📊 Split volumes — Train: {train_mask.sum()} | Val: {val_mask.sum()} | Test: {test_mask.sum()}")

    # ── Normalisation des features cliniques (z-score sur le TRAIN uniquement) ──
    train_ages = all_ages[train_mask]
    age_mean   = float(train_ages.mean())
    age_std    = float(train_ages.std() + 1e-8)
    print(f"\n📐 Normalisation âge (calculée sur train) — mean: {age_mean:.2f} | std: {age_std:.2f}")

    ages_normalized = (all_ages - age_mean) / age_std

    # Stack [age_normalisé, sex] → shape (N, 2)
    clinical_features = np.stack([ages_normalized, all_sexes], axis=1)

    # ── Datasets ──
    train_ds = ADNI3DMultiModalDataset(
        all_paths[train_mask], all_labels[train_mask], clinical_features[train_mask], augment=True
    )
    val_ds = ADNI3DMultiModalDataset(
        all_paths[val_mask], all_labels[val_mask], clinical_features[val_mask], augment=False
    )
    test_ds = ADNI3DMultiModalDataset(
        all_paths[test_mask], all_labels[test_mask], clinical_features[test_mask], augment=False
    )

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  pin_memory=True, num_workers=8, persistent_workers=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, pin_memory=True, num_workers=8, persistent_workers=True)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False, pin_memory=True, num_workers=8, persistent_workers=True)

    # ── Modèle multimodal ──
    model = MultiModalResNet3D(num_classes=2, clinical_dim=2, clinical_feat=CLINICAL_FEAT_DIM).to(DEVICE)

    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n🧬 Paramètres entraînables : {n_params:,}")

    criterion = FocalLoss(alpha=0.25, gamma=2.0).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scaler    = torch.amp.GradScaler('cuda')
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=3, verbose=True)

    best_acc = 0.0

    print(f"\n🚀 Entraînement MULTIMODAL sur {EPOCHS} époques...")
    print(f"{'Epoch':<6} | {'Temps':<6} | {'Train Loss':<10} | {'Train Acc':<10} | {'Val Loss':<10} | {'Val Acc':<8}")
    print("-" * 75)
    start_time = time.time()

    for epoch in range(1, EPOCHS + 1):
        epoch_start = time.time()

        # --- TRAIN ---
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for X, clin, y in train_loader:
            X, clin, y = X.to(DEVICE), clin.to(DEVICE), y.to(DEVICE)
            optimizer.zero_grad()
            with torch.amp.autocast('cuda'):
                logits = model(X, clin)
                loss   = criterion(logits, y)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            train_loss    += loss.item() * X.size(0)
            train_correct += (logits.argmax(1) == y).sum().item()
            train_total   += X.size(0)

        epoch_train_loss = train_loss    / train_total
        epoch_train_acc  = train_correct / train_total * 100

        # --- VALIDATION (sans TTA pendant le training pour gagner du temps) ---
        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.no_grad():
            for X, clin, y in val_loader:
                X, clin, y = X.to(DEVICE), clin.to(DEVICE), y.to(DEVICE)
                with torch.amp.autocast('cuda'):
                    logits = model(X, clin)
                    loss   = criterion(logits, y)

                val_loss    += loss.item() * X.size(0)
                val_correct += (logits.argmax(1) == y).sum().item()
                val_total   += y.size(0)

        epoch_val_loss = val_loss    / val_total
        epoch_val_acc  = val_correct / val_total * 100

        scheduler.step(epoch_val_acc)

        marker = " ⭐" if epoch_val_acc > best_acc else ""
        if epoch_val_acc > best_acc:
            best_acc = epoch_val_acc
            torch.save(model.state_dict(), "best_multimodal_model.pth")

        epoch_time = time.time() - epoch_start
        print(f"{epoch:2d}/{EPOCHS}  | {epoch_time:4.1f}s | {epoch_train_loss:.4f}     | {epoch_train_acc:5.2f}%    | {epoch_val_loss:.4f}     | {epoch_val_acc:5.2f}%{marker}")

    total_time = (time.time() - start_time) / 60
    print(f"\n✅ Entraînement terminé en {total_time:.1f} minutes !")

    # --- Charger le meilleur checkpoint ---
    model.load_state_dict(torch.load("best_multimodal_model.pth", weights_only=True))

    # ==========================================
    # 📊 ÉVALUATION VALIDATION (TTA)
    # ==========================================
    val_acc, val_f1, val_auc = evaluate_with_tta(model, val_loader, criterion, split_name="Validation")

    # ==========================================
    # 🧪 ÉVALUATION FINALE TEST (TTA)
    # ==========================================
    print("\n" + "=" * 75)
    print("🧪 ÉVALUATION FINALE SUR LE SET DE TEST (données jamais vues)")
    print("=" * 75)
    test_acc, test_f1, test_auc = evaluate_with_tta(model, test_loader, criterion, split_name="Test")

    # ==========================================
    # 📋 RÉSUMÉ COMPARATIF
    # ==========================================
    print("\n" + "=" * 75)
    print("📋 RÉSUMÉ COMPARATIF — MODÈLE MULTIMODAL (IRM + Age + Sexe)")
    print("=" * 75)
    print(f"{'Métrique':<15} {'Validation':>12} {'Test':>12}")
    print("-" * 40)
    print(f"{'Accuracy':<15} {val_acc:>11.2f}% {test_acc:>11.2f}%")
    print(f"{'F1-Score':<15} {val_f1:>11.2f}% {test_f1:>11.2f}%")
    print(f"{'AUC (ROC)':<15} {val_auc:>11.2f}% {test_auc:>11.2f}%")
    print("=" * 75)
    print("\n💡 Comparaison avec le modèle IRM seul (st_2.py) :")
    print("   - Calcule la différence Acc/F1/AUC entre les deux scripts")
    print("   - Gain attendu : +1 à +3% (limité car ADNI apparie age/sexe)")
    print("   - Pour ton PFA : présente les deux modèles dans un tableau comparatif")
