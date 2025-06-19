//
//  AudioRecorderManager.swift
//  Voice Assistant
//
//  Created by 陈彬 on 2025/6/18.
//

import Foundation
import AVFoundation

class AudioRecorderManager: NSObject, AVAudioRecorderDelegate {
    
    static let shared = AudioRecorderManager()
    
    private var recorder: AVAudioRecorder?
    private var recordingSession: AVAudioSession!
    private(set) var isRecording = false
    
    var onFinish: ((URL?) -> Void)?
    
    private override init() {
        super.init()
        recordingSession = AVAudioSession.sharedInstance()
    }
    
    /// 请求麦克风权限
    func requestPermission(completion: @escaping (Bool) -> Void) {
        recordingSession.requestRecordPermission { granted in
            DispatchQueue.main.async {
                completion(granted)
            }
        }
    }
    
    /// 开始录音
    func startRecording(fileName: String = "recording.m4a") {
        let audioFilename = getDocumentsDirectory().appendingPathComponent(fileName)
        
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 2,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        
        do {
            try recordingSession.setCategory(.playAndRecord, mode: .default)
            try recordingSession.setActive(true)
            
            recorder = try AVAudioRecorder(url: audioFilename, settings: settings)
            recorder?.delegate = self
            recorder?.isMeteringEnabled = true
            recorder?.prepareToRecord()
            recorder?.record()
            isRecording = true
            print("🎙️ 录音开始")
        } catch {
            print("❌ 无法开始录音：\(error.localizedDescription)")
            onFinish?(nil)
        }
    }
    
    /// 停止录音
    func stopRecording() {
        recorder?.stop()
        isRecording = false
        print("⏹️ 录音停止")
    }
    
    /// 取消录音（不保存）
    func cancelRecording() {
        recorder?.stop()
        recorder?.deleteRecording()
        isRecording = false
        print("🗑️ 录音已取消")
        onFinish?(nil)
    }
    
    // MARK: - AVAudioRecorderDelegate
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if flag {
            print("✅ 录音完成：\(recorder.url)")
            onFinish?(recorder.url)
        } else {
            print("❌ 录音失败")
            onFinish?(nil)
        }
    }
    
    // MARK: - 工具函数
    private func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}
