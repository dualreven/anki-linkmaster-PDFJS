import { StarRating } from "./components/star-rating.js";
import { TagsInput } from "./components/tags-input.js";

/**
 * @param {object} record
 * @returns {{ rating: StarRating, tags: TagsInput }}
 */
export function createPdfEditFormComponents(record) {
  const ratingContainer = document.getElementById("edit-rating");
  const tagsContainer = document.getElementById("edit-tags");

  return {
    rating: new StarRating({
      container: ratingContainer,
      value: record?.rating || 0,
      maxStars: 5,
    }),
    tags: new TagsInput({
      container: tagsContainer,
      tags: record?.tags || [],
      placeholder: "添加标签...",
      maxTags: 10,
    }),
  };
}

