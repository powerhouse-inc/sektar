import type { ConversionProfile, RecognitionSelection } from "../contracts.js";

export interface ModelAsset {
  readonly id: string;
  readonly label: string;
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly url: string;
}

export const MODEL_ASSETS: readonly ModelAsset[] = [
  {
    id: "tesseract-eng",
    label: "English",
    file: "eng.traineddata.gz",
    bytes: 10923060,
    sha256: "ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0/eng.traineddata.gz",
  },
  {
    id: "tesseract-spa",
    label: "Spanish",
    file: "spa.traineddata.gz",
    bytes: 8362819,
    sha256: "6cd52c545bceeacb2e43fad64fc0703a711c482ba20d1ca4b6915c09de9973e6",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa@1.0.0/4.0.0/spa.traineddata.gz",
  },
  {
    id: "tesseract-deu",
    label: "German",
    file: "deu.traineddata.gz",
    bytes: 7101284,
    sha256: "f5618a8b8d07f6c7a633ce243bf075bb90f4145bb15c9264734c7cc63aa33205",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0/deu.traineddata.gz",
  },
  {
    id: "tesseract-fra",
    label: "French",
    file: "fra.traineddata.gz",
    bytes: 6279601,
    sha256: "1c0916fac2dbd6f121ca8a57a92f08e4a119227602c7c984da986222eab6cd3b",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0/fra.traineddata.gz",
  },
  {
    id: "PP-OCRv6_tiny_det.ort",
    label: "Text detection (tiny)",
    file: "PP-OCRv6_tiny_det.ort",
    bytes: 1882568,
    sha256: "2816e82d26a09d6af722492f80f3059d458377c084eca88f34d84ddf9b385580",
    url: "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/detection/ort/PP-OCRv6_tiny_det.ort",
  },
  {
    id: "PP-OCRv6_tiny_rec.ort",
    label: "Text recognition (tiny)",
    file: "PP-OCRv6_tiny_rec.ort",
    bytes: 4530048,
    sha256: "efc46adf1bde1e05b58748268abb0e71791bfa8616c435676bbca13d1ea47767",
    url: "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/recognition/ort/PP-OCRv6_tiny_rec.ort",
  },
  {
    id: "PP-OCRv6_small_det.ort",
    label: "Text detection (small)",
    file: "PP-OCRv6_small_det.ort",
    bytes: 9982352,
    sha256: "c21be8d8268f0f45e2693b1d52432a290a56d008f6c1ff28b4baa7c35bab250e",
    url: "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/detection/ort/PP-OCRv6_small_det.ort",
  },
  {
    id: "PP-OCRv6_small_rec.ort",
    label: "Text recognition (small)",
    file: "PP-OCRv6_small_rec.ort",
    bytes: 21290816,
    sha256: "40bccd9fa3ae2d14d724bf9d020c8f0edfc801489477b92f7449162a538366df",
    url: "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/recognition/ort/PP-OCRv6_small_rec.ort",
  },
  {
    id: "PP-OCRv6_medium_det.ort",
    label: "Text detection (medium)",
    file: "PP-OCRv6_medium_det.ort",
    bytes: 62160320,
    sha256: "b3fad30d6dde47fd015d92a10f6cddf5969d910c6460d2f9b82de59e97931738",
    url: "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/detection/ort/PP-OCRv6_medium_det.ort",
  },
  {
    id: "PP-OCRv6_medium_rec.ort",
    label: "Text recognition (medium)",
    file: "PP-OCRv6_medium_rec.ort",
    bytes: 76691568,
    sha256: "14bf37252c87d2359764466c751d17787a28c9c5cbd5d64059a6f49b9dbd4ab4",
    url: "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/recognition/ort/PP-OCRv6_medium_rec.ort",
  },
  {
    id: "ppocrv6_tiny_dict.txt",
    label: "Character dictionary",
    file: "ppocrv6_tiny_dict.txt",
    bytes: 27157,
    sha256: "2f3717bbd530b681b6db3be35cc485e8a41a932b9558b833986bf0894eb21f2d",
    url: "https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/recognition/ppocrv6_tiny_dict.txt",
  },
  {
    id: "ppocrv6_dict.txt",
    label: "Character dictionary",
    file: "ppocrv6_dict.txt",
    bytes: 74948,
    sha256: "41557512862dfe31970cf22407742b629725461dd84c0d8771bde9c87c2202c8",
    url: "https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/47db434bfc5797a04019edf26eba99a3543ada79/recognition/ppocrv6_dict.txt",
  },
];
export const TESSERACT_LANGUAGES = ["eng", "spa", "deu", "fra"] as const;
export const PADDLE_PRESETS = ["v6Small", "v6Medium", "v6Tiny"] as const;

export function assetById(id: string): ModelAsset {
  const asset = MODEL_ASSETS.find((entry) => entry.id === id);
  if (!asset) throw new Error(`Unknown scanner file: ${id}`);
  return asset;
}

export function recognitionOf(
  profile: ConversionProfile,
): RecognitionSelection | null {
  return profile.reading.kind === "smart"
    ? profile.reading.fallback
    : profile.reading.kind === "recognize"
      ? profile.reading.engine
      : null;
}

export function recognitionAssets(
  selection: RecognitionSelection | null,
): readonly ModelAsset[] {
  if (!selection || selection.kind === "ai") return [];
  if (selection.engine === "tesseract") {
    return [...new Set(selection.languages)]
      .sort()
      .map((language) => assetById(`tesseract-${language}`));
  }
  const preset = selection.model ?? "v6Small";
  const size =
    preset === "v6Small"
      ? "small"
      : preset === "v6Medium"
        ? "medium"
        : preset === "v6Tiny"
          ? "tiny"
          : null;
  if (!size) throw new Error(`Unknown scanner model: ${preset}`);
  return [
    assetById(`PP-OCRv6_${size}_det.ort`),
    assetById(`PP-OCRv6_${size}_rec.ort`),
    assetById(size === "tiny" ? "ppocrv6_tiny_dict.txt" : "ppocrv6_dict.txt"),
  ];
}

export const profileAssets = (profile: ConversionProfile) =>
  recognitionAssets(recognitionOf(profile));
export function recognitionVersion(
  runtime: string,
  selection: RecognitionSelection,
): string {
  return `${runtime}+models:${recognitionAssets(selection)
    .map((asset) => asset.sha256)
    .join(".")}`;
}
