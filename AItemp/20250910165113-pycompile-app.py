import py_compile
import sys
import json
import os
import traceback

INPUT = "app.py"
OUTPUT = os.path.join("AItemp", "20250910165113-pycompile-app-output.json")

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

result = {"file": INPUT, "compiled": False, "error": None}

try:
    py_compile.compile(INPUT, doraise=True)
    result["compiled"] = True
    result["message"] = f"{INPUT} compiled successfully"
except Exception as exc:
    result["error"] = {"type": type(exc).__name__, "message": str(exc), "traceback": traceback.format_exc()}

print(json.dumps(result, ensure_ascii=False))
with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(json.dumps(result, ensure_ascii=False))

sys.exit(0 if result["compiled"] else 2
)