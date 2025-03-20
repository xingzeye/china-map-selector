import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 省份编码映射表
const provinceCodeMap = {
  '北京': '110000',
  '天津': '120000',
  '河北': '130000',
  '山西': '140000',
  '内蒙古': '150000',
  '辽宁': '210000',
  '吉林': '220000',
  '黑龙江': '230000',
  '上海': '310000',
  '江苏': '320000',
  '浙江': '330000',
  '安徽': '340000',
  '福建': '350000',
  '江西': '360000',
  '山东': '370000',
  '河南': '410000',
  '湖北': '420000',
  '湖南': '430000',
  '广东': '440000',
  '广西': '450000',
  '海南': '460000',
  '重庆': '500000',
  '四川': '510000',
  '贵州': '520000',
  '云南': '530000',
  '西藏': '540000',
  '陕西': '610000',
  '甘肃': '620000',
  '青海': '630000',
  '宁夏': '640000',
  '新疆': '650000'
};

// 确保目标目录存在
const targetDir = path.join(__dirname, '..', 'public', 'province-maps');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 下载单个省份地图数据
function downloadProvinceMap(province, code) {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
  const filePath = path.join(targetDir, `${province}.json`);

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP Status Code: ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          // 验证JSON数据格式
          const jsonData = JSON.parse(data);
          fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
          console.log(`✅ 成功下载 ${province} 地图数据`);
          resolve();
        } catch (error) {
          reject(new Error(`解析 ${province} 数据失败: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`下载 ${province} 数据失败: ${error.message}`));
    });
  });
}

// 按顺序下载所有省份地图数据
async function downloadAllProvinceMaps() {
  console.log('开始下载省份地图数据...');
  
  for (const [province, code] of Object.entries(provinceCodeMap)) {
    try {
      await downloadProvinceMap(province, code);
      // 添加延迟以避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ ${error.message}`);
    }
  }
  
  console.log('所有省份地图数据下载完成！');
}

// 执行下载
downloadAllProvinceMaps();