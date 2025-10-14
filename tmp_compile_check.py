import py_compile, sys
try:
    py_compile.compile(r"dist/latest/gui_launcher_dist.py", doraise=True)
    print("compile ok")
except Exception as e:
    print("compile error:", e)
    sys.exit(1)
