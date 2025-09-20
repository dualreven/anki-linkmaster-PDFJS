#!/usr/bin/env python3
"""
声音提醒脚本 - 多种方法尝试发出提醒音
支持 Windows 系统的多种声音API
"""

import sys
import time
import os


def beep_method_1_winsound():
    """方法1: 使用 winsound 模块 (Windows内置)"""
    try:
        import winsound
        print("🔊 方法1: 使用 winsound.Beep")

        # 三音节上升提醒
        winsound.Beep(1440, 200)
        time.sleep(0.05)
        winsound.Beep(1760, 200)
        time.sleep(0.05)
        winsound.Beep(2000, 300)

        return True
    except ImportError:
        print("❌ winsound 模块不可用")
        return False
    except Exception as e:
        print(f"❌ winsound 出错: {e}")
        return False


def beep_method_2_os():
    """方法2: 使用 os.system 调用系统命令"""
    try:
        print("🔊 方法2: 使用 os.system")

        # Windows 系统铃声
        if os.name == 'nt':  # Windows
            os.system('echo \a')
            time.sleep(0.1)
            os.system('echo \a')
            time.sleep(0.1)
            os.system('echo \a')
        else:
            print('bell', end='', flush=True)

        return True
    except Exception as e:
        print(f"❌ os.system 出错: {e}")
        return False


def beep_method_3_ctypes():
    """方法3: 使用 ctypes 直接调用 Windows API"""
    try:
        import ctypes
        print("🔊 方法3: 使用 ctypes + Windows API")

        # 加载 kernel32.dll
        kernel32 = ctypes.windll.kernel32

        # 三音节提醒
        kernel32.Beep(1440, 200)
        time.sleep(0.05)
        kernel32.Beep(1760, 200)
        time.sleep(0.05)
        kernel32.Beep(2000, 300)

        return True
    except ImportError:
        print("❌ ctypes 模块不可用")
        return False
    except Exception as e:
        print(f"❌ ctypes 出错: {e}")
        return False


def beep_method_4_pygame():
    """方法4: 使用 pygame 生成音频 (需要安装 pygame)"""
    try:
        import pygame
        import numpy as np
        print("🔊 方法4: 使用 pygame 音频")

        # 初始化 pygame mixer
        pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)

        def generate_tone(frequency, duration, sample_rate=22050):
            frames = int(duration * sample_rate)
            arr = np.sin(2 * np.pi * frequency * np.linspace(0, duration, frames))
            arr = (arr * 32767).astype(np.int16)
            arr = np.repeat(arr.reshape(frames, 1), 2, axis=1)
            return arr

        # 生成三个音调
        tone1 = generate_tone(1440, 0.2)
        tone2 = generate_tone(1760, 0.2)
        tone3 = generate_tone(2000, 0.3)

        # 播放音调
        for tone in [tone1, tone2, tone3]:
            sound = pygame.sndarray.make_sound(tone)
            sound.play()
            time.sleep(0.25)

        pygame.mixer.quit()
        return True
    except ImportError:
        print("❌ pygame 或 numpy 模块不可用")
        return False
    except Exception as e:
        print(f"❌ pygame 出错: {e}")
        return False


def beep_method_5_playsound():
    """方法5: 播放系统声音文件"""
    try:
        print("🔊 方法5: 播放系统声音文件")

        # Windows 系统声音文件路径
        system_sounds = [
            r"C:\Windows\Media\notify.wav",
            r"C:\Windows\Media\chord.wav",
            r"C:\Windows\Media\ding.wav",
            r"C:\Windows\Media\Windows Notify.wav"
        ]

        played = False
        for sound_file in system_sounds:
            if os.path.exists(sound_file):
                try:
                    import winsound
                    winsound.PlaySound(sound_file, winsound.SND_FILENAME)
                    played = True
                    break
                except:
                    continue

        if not played:
            # 尝试使用系统命令播放
            os.system("powershell -c (New-Object Media.SoundPlayer 'C:\\Windows\\Media\\notify.wav').PlaySync()")

        return True
    except Exception as e:
        print(f"❌ 系统声音播放出错: {e}")
        return False


def visual_reminder():
    """视觉提醒 - 如果声音都不工作"""
    print("\n" + "="*60)
    print("🚨 " + " "*20 + "提醒！" + " "*20 + " 🚨")
    print("🔔 " + " "*20 + "ALERT!" + " "*20 + " 🔔")
    print("⚠️  " + " "*20 + "注意！" + " "*20 + " ⚠️")
    print("="*60 + "\n")


def main():
    """主函数 - 尝试所有声音方法"""
    print("🎵 Python 声音提醒测试开始...")
    print("="*50)

    methods = [
        beep_method_1_winsound,
        beep_method_2_os,
        beep_method_3_ctypes,
        beep_method_4_pygame,
        beep_method_5_playsound
    ]

    success_count = 0

    for i, method in enumerate(methods, 1):
        print(f"\n测试方法 {i}:")
        try:
            if method():
                success_count += 1
                print(f"✅ 方法 {i} 执行成功")
                time.sleep(1)  # 间隔1秒
            else:
                print(f"❌ 方法 {i} 执行失败")
        except Exception as e:
            print(f"❌ 方法 {i} 异常: {e}")

    print(f"\n📊 测试结果: {success_count}/{len(methods)} 个方法执行成功")

    if success_count == 0:
        print("\n⚠️  所有声音方法都失败了，使用视觉提醒:")
        visual_reminder()
    else:
        print("🎉 至少有一种声音方法成功了！")

    return success_count > 0


if __name__ == "__main__":
    main()