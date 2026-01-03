import { getLogger } from "../../../../common/utils/logger.js";

export function showAnchorDialog({ title, initial, onConfirm }) {
  if (typeof onConfirm !== "function") {
    throw new Error("[AnchorSidebarUI] showAnchorDialog: onConfirm must be a function");
  }

  const logger = getLogger("AnchorSidebarDialog");

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9999;";

  const dialog = document.createElement("div");
  dialog.style.cssText =
    "background:#fff;border-radius:8px;min-width:320px;max-width:420px;padding:16px 16px 12px;box-shadow:0 8px 24px rgba(0,0,0,.2);";

  const h3 = document.createElement("div");
  h3.textContent = title || "";
  h3.style.cssText = "font-size:16px;font-weight:bold;margin-bottom:12px;color:#333;";

  const mkRow = (label, id, type, value, placeholder) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;margin:8px 0;gap:8px;";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.style.cssText = "width:72px;color:#555;";
    lab.setAttribute("for", id);
    const inp = document.createElement("input");
    inp.type = type;
    inp.id = id;
    inp.value = value ?? "";
    inp.placeholder = placeholder || "";
    inp.style.cssText = "flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;";
    row.appendChild(lab);
    row.appendChild(inp);
    return { row, inp };
  };

  const rName = mkRow("名称", "anchor-name", "text", initial?.name ?? "", "示例：章节A");
  const rPage = mkRow("页码", "anchor-page", "number", initial?.page_at ?? "1", "例如：12");
  rPage.inp.min = "1";
  const rPos = mkRow("位置(%)", "anchor-pos", "number", initial?.position ?? "", "0~100，可留空");
  rPos.inp.min = "0";
  rPos.inp.max = "100";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:14px;";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "取消";
  cancelBtn.style.cssText = "padding:6px 12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "保存";
  saveBtn.style.cssText = "padding:6px 12px;border:1px solid #1976d2;border-radius:4px;background:#1976d2;color:#fff;cursor:pointer;";

  const close = () => {
    try { document.body.removeChild(overlay); }
    catch (err) { logger.debug("[AnchorSidebarDialog] close failed", err); }
  };
  cancelBtn.addEventListener("click", close);
  saveBtn.addEventListener("click", () => {
    const vals = { name: rName.inp.value, page_at: rPage.inp.value, position: rPos.inp.value };
    try { onConfirm(vals); }
    catch (err) { logger.debug("[AnchorSidebarDialog] onConfirm failed", err); }
    close();
  });

  dialog.appendChild(h3);
  dialog.appendChild(rName.row);
  dialog.appendChild(rPage.row);
  dialog.appendChild(rPos.row);
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  try { rName.inp.focus(); }
  catch (err) { logger.debug("[AnchorSidebarDialog] focus failed", err); }
}
