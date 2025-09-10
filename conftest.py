import sys
from pathlib import Path

# Ensure project's src directory is on sys.path for all tests
ROOT = Path(__file__).resolve().parent
SRC_PATH = ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

# End of file