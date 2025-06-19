//
//  RecoderCell.swift
//  Voice Assistant
//
//  Created by 陈彬 on 2025/6/18.
//

import UIKit

class RecoderCell: UITableViewCell {

    @IBOutlet weak var playbtn: UIButton!
    
    @IBOutlet weak var timeLabel: UILabel!
    
    @IBOutlet weak var bgView: UIView!
    
    override func awakeFromNib() {
        super.awakeFromNib()
        self.bgView.layer.cornerRadius = 20
        // Initialization code
    }

    override func setSelected(_ selected: Bool, animated: Bool) {
        super.setSelected(selected, animated: animated)

        // Configure the view for the selected state
    }
    
}
