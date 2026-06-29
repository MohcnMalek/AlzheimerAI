from pathlib import Path
import argparse
import importlib

import numpy as np
import torch

from cnn_model import MultimodalCNNModel, preprocess_mri_array


BASE_DIR = Path(__file__).resolve().parents[1]

MODEL_PATH = BASE_DIR / "models" / "best_multimodal_model.pth"
DEFAULT_MRI_DIR = BASE_DIR / "data" / "ADNI_SKULL_STRIPPED"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

LABELS = {
    0: "CN",
    1: "AD"
}

# Default clinical values used when the caller does not provide them.
# sex encoding matches st_2_multimodal.py: F=1.0, M=0.0
# age is z-score normalised using train-set statistics from st_2_multimodal.py
DEFAULT_SEX = "F"
DEFAULT_AGE = 75.0

# Age normalisation constants — update these to match the values printed
# by st_2_multimodal.py during training (📐 Normalisation âge ... mean / std).
AGE_MEAN: float = 75.0
AGE_STD: float = 7.5


def load_nifti_volume(mri_path):
    """Load a .nii or .nii.gz MRI file and return a clean contiguous numpy array."""
    try:
        nib = importlib.import_module("nibabel")
    except ImportError as exc:
        raise ImportError(
            "nibabel is required for loading .nii/.nii.gz MRI files. "
            "Install it with: python -m pip install nibabel"
        ) from exc

    mri_path = Path(mri_path)

    if not mri_path.exists():
        raise FileNotFoundError(f"MRI file not found: {mri_path}")

    image = nib.load(str(mri_path))
    image = nib.as_closest_canonical(image)

    volume = image.get_fdata(dtype=np.float32)

    if volume.ndim != 3:
        raise ValueError(f"Expected a 3D MRI volume, got shape {volume.shape}.")

    volume = np.ascontiguousarray(volume.copy()).astype(np.float32)

    return volume


def load_cnn_model():
    """Load the multimodal CNN checkpoint."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}\n"
            "Run convert_models.py first to generate this file."
        )

    model = MultimodalCNNModel(num_classes=2, n_clinical=2)

    state_dict = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)

    model.load_state_dict(state_dict, strict=True)
    model.to(DEVICE)
    model.eval()

    return model


def encode_sex(sex) -> float:
    """Convert sex to float matching st_2_multimodal.py convention: F=1.0, M=0.0."""
    if isinstance(sex, str):
        s = sex.strip().upper()
        if s in ("F", "FEMALE", "WOMAN"):
            return 1.0
        if s in ("M", "MALE", "MAN"):
            return 0.0
        return 0.5  # unknown
    return float(sex)


def normalise_age(age: float) -> float:
    """Z-score normalise age using train-set statistics from st_2_multimodal.py."""
    return (age - AGE_MEAN) / AGE_STD


def predict_mri(mri_path, age=None, sex=None):
    """
    Predict CN or AD from one MRI file plus optional clinical features.

    Parameters
    ----------
    mri_path : str | Path
        Path to a .nii or .nii.gz file.
    age : float | None
        Patient age in years. Defaults to DEFAULT_AGE when not provided.
    sex : str | int | float | None
        Patient sex: 'M'/'F', 1/0, or None (defaults to DEFAULT_SEX).
    """
    mri_path = Path(mri_path)

    model = load_cnn_model()

    volume = load_nifti_volume(mri_path)
    volume = np.ascontiguousarray(volume.copy()).astype(np.float32)

    mri_tensor = preprocess_mri_array(volume).unsqueeze(0).to(DEVICE)

    sex_encoded = encode_sex(sex if sex is not None else DEFAULT_SEX)
    age_value = float(age) if age is not None else DEFAULT_AGE
    age_norm = normalise_age(age_value)

    # Feature order matches st_2_multimodal.py: [age_normalised, sex_encoded]
    clinical_tensor = torch.tensor(
        [[age_norm, sex_encoded]], dtype=torch.float32
    ).to(DEVICE)

    with torch.no_grad():
        with torch.amp.autocast(device_type="cuda", enabled=(DEVICE.type == "cuda")):
            logits = model(mri_tensor, clinical_tensor)
            probs = torch.softmax(logits.float(), dim=1)

    prob_cn = probs[0, 0].item()
    prob_ad = probs[0, 1].item()

    predicted_id = torch.argmax(probs, dim=1).item()

    prediction = LABELS[predicted_id]
    confidence = probs[0, predicted_id].item()

    return {
        "mri_path": str(mri_path),
        "prediction": prediction,
        "confidence": confidence,
        "prob_cn": prob_cn,
        "prob_ad": prob_ad,
        "clinical_age": age_value,
        "clinical_sex": "Female" if sex_encoded == 1.0 else "Male",
    }


def find_first_mri_file():
    """Find the first MRI file in ADNI_SKULL_STRIPPED."""
    nii_files = (
        list(DEFAULT_MRI_DIR.rglob("*.nii"))
        + list(DEFAULT_MRI_DIR.rglob("*.nii.gz"))
    )

    if not nii_files:
        raise FileNotFoundError(
            f"No .nii or .nii.gz files found in: {DEFAULT_MRI_DIR}"
        )

    return nii_files[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=str, default=None)
    parser.add_argument("--age", type=float, default=None)
    parser.add_argument("--sex", type=str, default=None, choices=["M", "F"])
    args = parser.parse_args()

    if args.image is None:
        mri_path = find_first_mri_file()
        print(f"No image provided. Using first MRI found:\n{mri_path}")
    else:
        mri_path = args.image

    result = predict_mri(mri_path, age=args.age, sex=args.sex)

    print("=" * 70)
    print("CNN MRI PREDICTION")
    print("=" * 70)
    print(f"MRI file       : {result['mri_path']}")
    print(f"Patient age    : {result['clinical_age']}")
    print(f"Patient sex    : {result['clinical_sex']}")
    print(f"Prediction     : {result['prediction']}")
    print(f"Confidence     : {result['confidence']:.4f}")
    print(f"Probability CN : {result['prob_cn']:.4f}")
    print(f"Probability AD : {result['prob_ad']:.4f}")


if __name__ == "__main__":
    main()
