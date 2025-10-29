# -*- coding: utf-8 -*-
def test_launcher_exports():
    import src.backend.launcher as L
    assert hasattr(L, 'LegacyBackendLauncher')
    assert hasattr(L, 'BackendLauncher')
    assert hasattr(L, 'BackendPortManager')
    assert hasattr(L, 'BackendProcessManager')

def test_legacy_launcher_constructs():
    from src.backend.launcher import LegacyBackendLauncher
    inst = LegacyBackendLauncher()
    assert inst is not None

