/* @jest-environment jsdom */
// UTF-8, \n
import {
  Annotation as CommonAnnotation,
  AnnotationType as CommonAnnotationType,
  HighlightColor as CommonHighlightColor
} from "../../../../../common/models/annotation.js";

import {
  Annotation as FeatureAnnotation,
  AnnotationType as FeatureAnnotationType,
  HighlightColor as FeatureHighlightColor
} from "../index.js";

test("Annotation model is single source (exports are same references)", () => {
  expect(FeatureAnnotation).toBe(CommonAnnotation);
  expect(FeatureAnnotationType).toBe(CommonAnnotationType);
  expect(FeatureHighlightColor).toBe(CommonHighlightColor);
});
