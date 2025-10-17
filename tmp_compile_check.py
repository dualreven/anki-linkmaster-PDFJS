import py_compile, sys
try:
    # 首选新路径
    py_compile.compile(r"dist/latest/gui_launcher.py", doraise=True)
    print("compile ok")
except Exception as e:
    # 兼容旧路径
    try:
        py_compile.compile(r"dist/latest/gui_launcher_dist.py", doraise=True)
        print("compile ok (compat)")
    except Exception as e2:
        print("compile error:", e, e2)
        sys.exit(1)
