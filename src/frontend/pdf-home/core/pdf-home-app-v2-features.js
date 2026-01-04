/**
 * PDFHomeAppV2 的功能域装配（仅负责“要注册哪些 Feature”）
 *
 * 详细说明见：docs/standards/pdf-home-app-v2.md
 */

// 基础设施功能
import { PDFHomeInfraAppFeature } from "../features/infra-app/index.js";

// UI/布局
import { SidebarFeature } from "../features/sidebar/index.js";
import { WindowControlsFeature } from "../../common/features/window-controls/index.js";

// 搜索/筛选
import { SearchFeature } from "../features/search/index.js";
import { FilterFeature } from "../features/filter/index.js";
import { SearchResultsFeature } from "../features/search-results/index.js";
import { SearchResultItemFeature } from "../features/search-result-item/index.js";

// 核心功能
import { AddFilesFeature } from "../features/add-files/index.js";
import { PDFSorterFeature } from "../features/pdf-sorter/index.js";
import { PDFEditFeature } from "../features/pdf-edit/index.js";

// 侧边栏子功能
import { SavedFiltersFeature } from "../features/sidebar/saved-filters/index.js";
import { RecentSearchesFeature } from "../features/sidebar/recent-searches/index.js";
import { RecentOpenedFeature } from "../features/sidebar/recent-opened/index.js";
import { RecentAddedFeature } from "../features/sidebar/recent-added/index.js";

export function createPDFHomeAppV2Features() {
  return [
    // 基础设施功能（最先注册）
    new PDFHomeInfraAppFeature(),

    // UI布局功能
    new SidebarFeature(),
    new WindowControlsFeature({
      bridgeName: "pyqtBridge",
      containerSelector: ".toolbar-controls",
    }),

    // 搜索和筛选功能（按优先级顺序）
    new SearchFeature(),
    new FilterFeature(),
    new SearchResultsFeature(),

    // 核心功能
    new AddFilesFeature(),
    new PDFSorterFeature(),
    new PDFEditFeature(),

    // 侧边栏子功能
    new SavedFiltersFeature(),
    new RecentSearchesFeature(),
    new RecentOpenedFeature(),
    new RecentAddedFeature(),

    // 搜索结果条目渲染
    new SearchResultItemFeature(),
  ];
}

