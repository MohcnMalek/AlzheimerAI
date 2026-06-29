"""
Script de conversion des dossiers modeles -> fichiers .pt / .pth
Executer avec : python convert_models.py
"""
import sys
import io
import os
import zipfile
from pathlib import Path

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent

ROBERTA_DIR   = BASE_DIR / "best_roberta_hybrid_seed40"
MULTIMODAL_DIR = BASE_DIR / "best_multimodal_model"

ROBERTA_OUT   = BASE_DIR / "nlp_rag_module" / "model" / "best_roberta_hybrid_seed40.pt"
MULTIMODAL_OUT = BASE_DIR / "cnn_module" / "models" / "best_resnet3d_model.pth"


def dir_to_pt(dir_path: Path, output_path: Path, label: str) -> bool:
    """
    Essai 1 : torch.load direct sur le dossier (PyTorch >= 2.1)
    Essai 2 : repackaging en zip (format archive PyTorch standard)
    """
    import torch

    print(f"\n{'='*60}")
    print(f"  Traitement : {label}")
    print(f"  Source     : {dir_path}")
    print(f"  Destination: {output_path}")
    print(f"{'='*60}")

    # --- Essai 1 : chargement direct depuis le dossier ---
    print("\n[1/2] Tentative de chargement direct (torch.load sur dossier)...")
    try:
        state_dict = torch.load(str(dir_path), map_location="cpu", weights_only=False)
        print(f"      ✓ Chargement direct OK  ({type(state_dict).__name__})")
        _inspect_and_save(state_dict, output_path, label)
        return True
    except Exception as e:
        print(f"      ✗ Échec : {e}")

    # --- Essai 2 : repackaging en fichier zip PyTorch ---
    print("\n[2/2] Tentative de repackaging en archive zip PyTorch...")
    try:
        pkl_path = dir_path / "data.pkl"
        if not pkl_path.exists():
            print("      ✗ data.pkl introuvable — format non reconnu.")
            return False

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
            # Fichiers de métadonnées du format PyTorch
            metadata_files = ["version", "byteorder", ".format_version", ".storage_alignment"]
            for mf in metadata_files:
                mf_path = dir_path / mf
                if mf_path.exists():
                    zf.write(mf_path, f"archive/{mf}")
                    print(f"      Meta ajouté : archive/{mf}")

            # Pickle principal
            zf.write(pkl_path, "archive/data.pkl")

            # Tenseurs
            data_dir = dir_path / "data"
            tensor_count = 0
            if data_dir.exists():
                files = sorted(data_dir.iterdir(), key=lambda x: int(x.name))
                for f in files:
                    zf.write(f, f"archive/data/{f.name}")
                    tensor_count += 1
                print(f"      Tenseurs ajoutés : {tensor_count}")

        buf.seek(0)
        state_dict = torch.load(buf, map_location="cpu", weights_only=False)
        print(f"      ✓ Repackaging OK ({type(state_dict).__name__})")
        _inspect_and_save(state_dict, output_path, label)
        return True
    except Exception as e:
        print(f"      ✗ Échec : {e}")
        return False


def _inspect_and_save(state_dict, output_path: Path, label: str):
    import torch
    print(f"\n  Aperçu du contenu ({label}) :")
    if isinstance(state_dict, dict):
        keys = list(state_dict.keys())
        print(f"    Nombre de clés : {len(keys)}")
        for k in keys[:8]:
            v = state_dict[k]
            shape = v.shape if hasattr(v, "shape") else type(v)
            dtype = v.dtype if hasattr(v, "dtype") else ""
            print(f"    - {k}: {shape} {dtype}")
        if len(keys) > 8:
            print(f"    ... (+{len(keys)-8} autres)")
    else:
        print(f"    Type : {type(state_dict)}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(state_dict, str(output_path))
    size_mb = output_path.stat().st_size / 1024 / 1024
    print(f"\n  ✓ Fichier sauvegardé : {output_path}")
    print(f"    Taille : {size_mb:.1f} MB")


def main():
    print("\n" + "="*60)
    print("  CONVERSION DES MODELES")
    print("="*60)

    try:
        import torch
        print(f"  PyTorch version : {torch.__version__}")
    except ImportError:
        print("  ERREUR : PyTorch n'est pas installé.")
        print("  Exécutez : pip install torch")
        sys.exit(1)

    results = {}

    if ROBERTA_DIR.exists():
        results["RoBERTa NLP"] = dir_to_pt(ROBERTA_DIR, ROBERTA_OUT, "RoBERTa NLP")
    else:
        print(f"\n  DOSSIER ABSENT : {ROBERTA_DIR}")
        results["RoBERTa NLP"] = False

    if MULTIMODAL_DIR.exists():
        results["Multimodal CNN"] = dir_to_pt(MULTIMODAL_DIR, MULTIMODAL_OUT, "Multimodal CNN")
    else:
        print(f"\n  DOSSIER ABSENT : {MULTIMODAL_DIR}")
        results["Multimodal CNN"] = False

    print("\n" + "="*60)
    print("  RÉSUMÉ")
    print("="*60)
    for name, ok in results.items():
        status = "✓ OK" if ok else "✗ ECHEC"
        print(f"  {status}  {name}")

    if all(results.values()):
        print("\n  Tous les modèles sont prêts.")
        print("  Vous pouvez maintenant lancer : streamlit run app.py")
    else:
        print("\n  Certains modèles n'ont pas pu être convertis.")
        print("  Copiez la sortie ci-dessus et partagez-la pour diagnostic.")


if __name__ == "__main__":
    main()
