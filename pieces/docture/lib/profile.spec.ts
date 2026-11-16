import { describe, expect, it } from "vitest";
import {
  conversionProfileSchema,
  defaultConversionProfile,
  type ConversionProfile,
} from "../../../conversions/contracts.js";
import {
  localOcrOf,
  methodOf,
  oneOffProfile,
  parseLanguages,
  READING_METHODS,
  usesAppScanner,
  withLanguages,
  withMethod,
  withOcrModel,
  withRecognition,
} from "./profile.js";

const smart = defaultConversionProfile;
const paddle = withOcrModel(
  withRecognition(smart, "paddleocr", ["eng"]),
  "server",
);

describe("a profile as a person picks it", () => {
  it("is a valid profile of the contract for every method, from any other", () => {
    const starts: ConversionProfile[] = [
      smart,
      withMethod(smart, "digital"),
      withMethod(paddle, "ocr"),
    ];
    for (const start of starts) {
      for (const method of READING_METHODS) {
        const next = withMethod(start, method);
        expect(methodOf(next)).toBe(method);
        expect(conversionProfileSchema.safeParse(next).success).toBe(true);
      }
    }
  });

  it("recognizes nothing on Text only", () => {
    const digital = withMethod(smart, "digital");
    expect(localOcrOf(digital)).toBeNull();
    expect(withRecognition(digital, "paddleocr")).toEqual(digital);
  });

  it("keeps the OCR engine and languages when the method changes around them", () => {
    const spanish = withLanguages(withRecognition(smart, "paddleocr"), [
      "eng",
      "spa",
    ]);
    const asOcr = withMethod(spanish, "ocr");
    expect(localOcrOf(asOcr)).toEqual({
      kind: "ocr",
      engine: "paddleocr",
      languages: ["eng", "spa"],
    });
    expect(localOcrOf(withMethod(asOcr, "smart"))).toEqual(
      localOcrOf(asOcr),
    );
  });

  it("comes back from Text only to the local engine it is given", () => {
    const back = withMethod(withMethod(smart, "digital"), "ocr", {
      kind: "ocr",
      engine: "paddleocr",
      languages: ["eng", "spa"],
    });
    expect(localOcrOf(back)).toEqual({
      kind: "ocr",
      engine: "paddleocr",
      languages: ["eng", "spa"],
    });
  });
});

describe("the engine that recognizes pages", () => {
  it("keeps its model when its languages change", () => {
    expect(localOcrOf(withLanguages(paddle, ["eng", "deu"]))).toEqual({
      kind: "ocr",
      engine: "paddleocr",
      languages: ["eng", "deu"],
      model: "server",
    });
    expect(localOcrOf(withRecognition(paddle, "paddleocr", ["fra"]))).toEqual({
      kind: "ocr",
      engine: "paddleocr",
      languages: ["fra"],
      model: "server",
    });
  });

  it("starts another engine without the first one's model", () => {
    expect(localOcrOf(withRecognition(paddle, "tesseract"))).toEqual({
      kind: "ocr",
      engine: "tesseract",
      languages: ["eng"],
    });
  });

  it("takes another model, or goes back to the host's default", () => {
    expect(localOcrOf(withOcrModel(paddle, "mobile"))?.model).toBe("mobile");
    expect(localOcrOf(withOcrModel(paddle, null))).toEqual({
      kind: "ocr",
      engine: "paddleocr",
      languages: ["eng"],
    });
  });

  it("is left alone where no local engine reads pages", () => {
    const digital = withMethod(smart, "digital");
    expect(withOcrModel(digital, "server")).toEqual(digital);
    expect(withLanguages(digital, ["deu"])).toEqual(digital);
    expect(withLanguages(smart, [])).toEqual(smart);
  });
});

describe("OCR languages typed as text", () => {
  it("are read however they are separated, once each", () => {
    expect(parseLanguages("eng, spa+deu  eng;fra")).toEqual([
      "eng",
      "spa",
      "deu",
      "fra",
    ]);
    expect(parseLanguages("  ")).toEqual([]);
  });
});

describe("one PDF read with the app's scanner", () => {
  const app = withRecognition(smart, "tesseract", ["eng", "spa"]);

  it("changes the method and narrows the app's languages, never more", () => {
    expect(oneOffProfile(app, "smart")).toEqual(app);
    expect(oneOffProfile(app, "ocr")).toEqual(withMethod(app, "ocr"));
    expect(oneOffProfile(app, "ocr", ["spa", "deu"])).toEqual(
      withLanguages(withMethod(app, "ocr"), ["spa"]),
    );
    expect(oneOffProfile(app, "smart", ["deu"])).toEqual(app);
    expect(oneOffProfile(paddle, "ocr")).toEqual(withMethod(paddle, "ocr"));
  });

  it("has no scanning method without a scanner in the app's profile", () => {
    const digital = withMethod(smart, "digital");
    expect(oneOffProfile(digital, "smart")).toBeNull();
    expect(oneOffProfile(digital, "ocr")).toBeNull();
    expect(oneOffProfile(digital, "digital")).toEqual(digital);
  });

  it("accepts only the app's engine, model and some of its languages", () => {
    expect(usesAppScanner(withMethod(app, "digital"), app)).toBe(true);
    expect(usesAppScanner(withLanguages(app, ["spa"]), app)).toBe(true);
    expect(usesAppScanner(withLanguages(app, ["eng", "fra"]), app)).toBe(false);
    expect(usesAppScanner(withRecognition(app, "paddleocr"), app)).toBe(false);
    expect(usesAppScanner(withOcrModel(paddle, "v6Tiny"), paddle)).toBe(false);
    expect(usesAppScanner(app, withMethod(app, "digital"))).toBe(false);
  });
});
