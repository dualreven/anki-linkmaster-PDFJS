#!/usr/bin/env python3
"""
快速声音提醒 - AI提醒用户使用
"""

import sys
import time

def ai_reminder_beep():
    """AI专用提醒音 - 三音节上升音调"""
    try:
        # 方法1: winsound (最可靠)
        import winsound
        winsound.Beep(1440, 200)  # 高音C
        time.sleep(0.05)
        winsound.Beep(1760, 200)  # 高音F
        time.sleep(0.05)
        winsound.Beep(2000, 300)  # 高音G
        return True
    except:
        try:
            # 方法2: ctypes 备用
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.Beep(1440, 200)
            time.sleep(0.05)
            kernel32.Beep(1760, 200)
            time.sleep(0.05)
            kernel32.Beep(2000, 300)
            return True
        except:
            # 方法3: 系统铃声
            import os
            for _ in range(3):
                os.system('echo \a')
                time.sleep(0.1)
            return True

if __name__ == "__main__":
    ai_reminder_beep()