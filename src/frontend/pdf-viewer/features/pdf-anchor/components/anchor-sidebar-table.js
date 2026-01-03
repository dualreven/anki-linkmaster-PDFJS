export function createAnchorSidebarTable() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "flex:1;overflow:auto;padding:8px;";

  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;font-size:13px;";

  const thead = document.createElement("thead");
  const thr = document.createElement("tr");
  const thName = document.createElement("th"); thName.textContent = "名称";
  const thPage = document.createElement("th"); thPage.textContent = "页码";
  const thPos = document.createElement("th"); thPos.textContent = "页内位置(%)";
  const thActive = document.createElement("th"); thActive.textContent = "是否激活";
  [thName, thPage, thPos, thActive].forEach((th) => {
    th.style.cssText = "text-align:left;border-bottom:1px solid #eee;padding:6px;color:#444;";
    thr.appendChild(th);
  });
  thead.appendChild(thr);

  const tbody = document.createElement("tbody");
  tbody.dataset.role = "anchor-tbody";

  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

