//
//  ViewController.swift
//  Voice Assistant
//
//  Created by 陈彬 on 2025/6/18.
//

import UIKit

class ViewController: UIViewController,UITableViewDelegate,UITableViewDataSource {

    @IBOutlet weak var tableView: UITableView!
    
    var datasouece:[String] = Array()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view.
        AudioRecorderManager.shared.requestPermission { granted in
            if granted {
                print("🎧 麦克风权限已授权")
            } else {
                print("⚠️ 请在设置中启用麦克风权限")
            }
        }
        self.tableView.register(UINib.init(nibName: "RecoderCell", bundle: Bundle.main), forCellReuseIdentifier: "RecoderCell")
    }


    @IBAction func clickdown(_ sender: UIButton) {
        AudioRecorderManager.shared.onFinish = { url in
            if let url = url {
                print("录音文件保存于：\(url)")
            }
        }
        AudioRecorderManager.shared.startRecording()
    }
    
    
    @IBAction func endClick(_ sender: UIButton) {
        AudioRecorderManager.shared.stopRecording()
    }
    
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        self.datasouece.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell:RecoderCell = tableView.dequeueReusableCell(withIdentifier: "RecoderCell", for: indexPath) as! RecoderCell
        cell.playbtn.tag = indexPath.row
        cell.playbtn.addTarget(self, action: #selector(playRecord), for: .touchUpInside)
        return cell
    }
    
    
    @objc func playRecord(btn:UIButton) {
        let record = self.datasouece[btn.tag]
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        
    }
    
    
}

