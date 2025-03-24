import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import './App.css'

function App() {
  // 状态管理变量定义
  const [currentPage, setCurrentPage] = useState('map') // 当前显示的页面：'map' 或 'food'
  const [mapOption, setMapOption] = useState({}) // 中国地图配置
  const [provinceMapOption, setProvinceMapOption] = useState({}) // 省份地图配置
  const [selectedProvince, setSelectedProvince] = useState('') // 当前选中的省份
  const [showProvinceMap, setShowProvinceMap] = useState(false) // 是否显示省份地图
  const [isProvinceMapLoading, setIsProvinceMapLoading] = useState(false) // 省份地图是否加载中
  const [isFinalSelection, setIsFinalSelection] = useState(false) // 是否为最终选择结果
  const [showInfo, setShowInfo] = useState(false) // 是否显示使用说明
  // 新增状态管理变量
  const [isCitySpinning, setIsCitySpinning] = useState(false) // 是否正在随机选择城市中
  const [selectedCity, setSelectedCity] = useState('') // 当前选中的城市
  const [showCitySelector, setShowCitySelector] = useState(false) // 是否显示城市选择器
  const [isAutoPlaying, setIsAutoPlaying] = useState(false) // 是否正在自动轮播
  const [autoPlayTimer, setAutoPlayTimer] = useState(null) // 轮播定时器
  
  // 美食选择器相关状态
  const [showFoodSelector, setShowFoodSelector] = useState(false) // 是否显示美食选择器
  const [foodData, setFoodData] = useState([]) // 美食数据
  const [selectedFood, setSelectedFood] = useState(null) // 当前选中的美食
  const [isFoodSpinning, setIsFoodSpinning] = useState(false) // 是否正在随机选择美食
  const [foodCountdown, setFoodCountdown] = useState(10) // 美食选择倒计时
  const [showFoodResult, setShowFoodResult] = useState(false) // 是否显示最终选中的美食结果

  // 省份编码映射表，用于获取省份地图数据
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
  }

  // 省份名称映射表，用于将地图上的名称转换为简称
  const provinceNameMap = {
    '北京市': '北京',
    '天津市': '天津',
    '河北省': '河北',
    '山西省': '山西',
    '内蒙古自治区': '内蒙古',
    '辽宁省': '辽宁',
    '吉林省': '吉林',
    '黑龙江省': '黑龙江',
    '上海市': '上海',
    '江苏省': '江苏',
    '浙江省': '浙江',
    '安徽省': '安徽',
    '福建省': '福建',
    '江西省': '江西',
    '山东省': '山东',
    '河南省': '河南',
    '湖北省': '湖北',
    '湖南省': '湖南',
    '广东省': '广东',
    '广西壮族自治区': '广西',
    '海南省': '海南',
    '重庆市': '重庆',
    '四川省': '四川',
    '贵州省': '贵州',
    '云南省': '云南',
    '西藏自治区': '西藏',
    '陕西省': '陕西',
    '甘肃省': '甘肃',
    '青海省': '青海',
    '宁夏回族自治区': '宁夏',
    '新疆维吾尔自治区': '新疆'
  }

  // 添加中国主要地级市数据
  const majorCities = [
    // 北京、天津、上海、重庆直辖市
    {name: '北京市', province: '北京'},
    {name: '天津市', province: '天津'},
    {name: '上海市', province: '上海'},
    {name: '重庆市', province: '重庆'},
    // 河北省
    {name: '石家庄市', province: '河北'},
    {name: '唐山市', province: '河北'},
    {name: '保定市', province: '河北'},
    // 山西省
    {name: '太原市', province: '山西'},
    {name: '大同市', province: '山西'},
    // 内蒙古
    {name: '呼和浩特市', province: '内蒙古'},
    {name: '包头市', province: '内蒙古'},
    // 辽宁省
    {name: '沈阳市', province: '辽宁'},
    {name: '大连市', province: '辽宁'},
    // 吉林省
    {name: '长春市', province: '吉林'},
    {name: '吉林市', province: '吉林'},
    // 黑龙江
    {name: '哈尔滨市', province: '黑龙江'},
    {name: '齐齐哈尔市', province: '黑龙江'},
    // 江苏省
    {name: '南京市', province: '江苏'},
    {name: '苏州市', province: '江苏'},
    {name: '无锡市', province: '江苏'},
    // 浙江省
    {name: '杭州市', province: '浙江'},
    {name: '宁波市', province: '浙江'},
    {name: '温州市', province: '浙江'},
    // 安徽省
    {name: '合肥市', province: '安徽'},
    {name: '芜湖市', province: '安徽'},
    // 福建省
    {name: '福州市', province: '福建'},
    {name: '厦门市', province: '福建'},
    // 江西省
    {name: '南昌市', province: '江西'},
    {name: '景德镇市', province: '江西'},
    // 山东省
    {name: '济南市', province: '山东'},
    {name: '青岛市', province: '山东'},
    {name: '烟台市', province: '山东'},
    // 河南省
    {name: '郑州市', province: '河南'},
    {name: '洛阳市', province: '河南'},
    // 湖北省
    {name: '武汉市', province: '湖北'},
    {name: '宜昌市', province: '湖北'},
    // 湖南省
    {name: '长沙市', province: '湖南'},
    {name: '株洲市', province: '湖南'},
    // 广东省
    {name: '广州市', province: '广东'},
    {name: '深圳市', province: '广东'},
    {name: '珠海市', province: '广东'},
    {name: '汕头市', province: '广东'},
    // 广西
    {name: '南宁市', province: '广西'},
    {name: '桂林市', province: '广西'},
    // 海南省
    {name: '海口市', province: '海南'},
    {name: '三亚市', province: '海南'},
    // 四川省
    {name: '成都市', province: '四川'},
    {name: '绵阳市', province: '四川'},
    // 贵州省
    {name: '贵阳市', province: '贵州'},
    {name: '遵义市', province: '贵州'},
    // 云南省
    {name: '昆明市', province: '云南'},
    {name: '大理市', province: '云南'},
    // 西藏
    {name: '拉萨市', province: '西藏'},
    // 陕西省
    {name: '西安市', province: '陕西'},
    {name: '宝鸡市', province: '陕西'},
    // 甘肃省
    {name: '兰州市', province: '甘肃'},
    // 青海省
    {name: '西宁市', province: '青海'},
    // 宁夏
    {name: '银川市', province: '宁夏'},
    // 新疆
    {name: '乌鲁木齐市', province: '新疆'},
    {name: '克拉玛依市', province: '新疆'}
  ];

  // 组件加载时初始化中国地图数据和美食数据
  useEffect(() => {
    // 从本地获取中国地图GeoJSON数据
    fetch('/china-map-selector/china.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('网络响应异常')
        }
        return response.json()
      })
      .then(geoJson => {
        if (!geoJson || !geoJson.features) {
          throw new Error('地图数据格式异常')
        }
        // 注册中国地图到ECharts
        echarts.registerMap('china', geoJson)
        // 初始化地图配置
        updateMapOption()
      })
      .catch(error => {
        console.error('加载中国地图数据失败:', error)
        // 在界面上显示错误信息
        setMapOption({
          title: {
            text: '地图加载失败，请刷新重试',
            left: 'center',
            top: 'center'
          }
        })
      })
      
    // 加载美食数据
    fetch('/china-map-selector/food_data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('加载美食数据失败')
        }
        return response.json()
      })
      .then(data => {
        setFoodData(data)
      })
      .catch(error => {
        console.error('加载美食数据失败:', error)
      })
  }, [])

  // 当选中省份变化或选择状态变化时，加载省份地图
  useEffect(() => {
    if (selectedProvince && isFinalSelection) {
      setIsProvinceMapLoading(true)
      // 最终选择确定后，加载省份详细地图
      loadProvinceMap(selectedProvince)
    } else if (!selectedProvince) {
      // 没有选中省份时，隐藏省份地图
      setShowProvinceMap(false)
    }
  }, [selectedProvince, isFinalSelection])

  // 当选中省份变化时，显示或隐藏城市选择器
  useEffect(() => {
    if (selectedProvince) {
      setShowCitySelector(true);
    } else {
      setShowCitySelector(false);
      setSelectedCity('');
    }
  }, [selectedProvince]);

  // 加载省份地图数据
  const loadProvinceMap = (province) => {
    // 获取省份编码
    const provinceCode = provinceCodeMap[province]
    if (!provinceCode) {
      setIsProvinceMapLoading(false)
      return
    }

    // 设置加载状态
    setIsProvinceMapLoading(true)
    setShowProvinceMap(true)

    // 从本地加载省份地图GeoJSON数据
    fetch(`/china-map-selector/province-maps/${province}.json`)
      .then(response => {
        if (!response.ok) {
          throw new Error('网络响应异常')
        }
        return response.json()
      })
      .then(geoJson => {
        if (!geoJson || !geoJson.features) {
          throw new Error('地图数据格式异常')
        }
        // 注册省份地图到ECharts
        echarts.registerMap(province, geoJson)
        
        // 设置省份地图配置
        setProvinceMapOption({
          backgroundColor: '#f5f8fa', // 背景色
          title: {
            text: `${province}地图`, // 标题文本
            left: 'center', // 标题居中
            top: 20,
            textStyle: {
              color: '#2c3e50',
              fontSize: 22,
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.1)' // 文字阴影
            }
          },
          tooltip: {
            trigger: 'item', // 提示框触发类型
            formatter: '{b}', // 提示框格式
            backgroundColor: 'rgba(44,62,80,0.85)',
            borderColor: '#fff',
            borderWidth: 2,
            padding: [8, 12],
            textStyle: {
              color: '#fff',
              fontSize: 14
            }
          },
          series: [{
            name: province,
            type: 'map', // 图表类型为地图
            map: province, // 使用注册的省份地图
            roam: true, // 允许缩放和平移
            scaleLimit: {
              min: 1, // 最小缩放比例
              max: 10 // 最大缩放比例
            },
            zoom: 1.2, // 初始缩放比例
            label: {
              show: true, // 显示地名
              color: '#2c3e50',
              fontSize: 12,
              fontWeight: 500
            },
            itemStyle: {
              areaColor: '#e8f4f8', // 区域颜色
              borderColor: '#a3d8f4', // 边界颜色
              borderWidth: 1.5,
              shadowColor: 'rgba(0,0,0,0.15)',
              shadowBlur: 8
            },
            emphasis: {
              // 鼠标悬停时的样式
              itemStyle: {
                areaColor: '#ffd6a5',
                borderColor: '#ffab4c',
                borderWidth: 2.5,
                shadowColor: 'rgba(255, 171, 76, 0.7)',
                shadowBlur: 35,
                shadowOffsetX: 2,
                shadowOffsetY: 2
              },
              label: {
                show: true,
                color: '#2c3e50',
                fontSize: 14,
                fontWeight: 'bold'
              }
            },
            // 地图动画设置
            animation: true,
            animationDuration: 600,
            animationEasing: 'elasticOut',
            animationDelay: (idx) => idx * 100,
            animationDurationUpdate: 450,
            animationEasingUpdate: 'circularInOut'
          }]
        })
        // 结束加载状态
        setIsProvinceMapLoading(false)
      })
      .catch(error => {
        console.error('加载省份地图失败:', error)
        setIsProvinceMapLoading(false)
      })
  }

  // 更新中国地图配置
  const updateMapOption = (province = '', shouldHighlight = false) => {
    // 获取省份完整名称
    const getMapName = (name) => {
      const nameMap = {
        '北京': '北京市',
        '天津': '天津市',
        '河北': '河北省',
        '山西': '山西省',
        '内蒙古': '内蒙古自治区',
        '辽宁': '辽宁省',
        '吉林': '吉林省',
        '黑龙江': '黑龙江省',
        '上海': '上海市',
        '江苏': '江苏省',
        '浙江': '浙江省',
        '安徽': '安徽省',
        '福建': '福建省',
        '江西': '江西省',
        '山东': '山东省',
        '河南': '河南省',
        '湖北': '湖北省',
        '湖南': '湖南省',
        '广东': '广东省',
        '广西': '广西壮族自治区',
        '海南': '海南省',
        '重庆': '重庆市',
        '四川': '四川省',
        '贵州': '贵州省',
        '云南': '云南省',
        '西藏': '西藏自治区',
        '陕西': '陕西省',
        '甘肃': '甘肃省',
        '青海': '青海省',
        '宁夏': '宁夏回族自治区',
        '新疆': '新疆维吾尔自治区'
      }
      return nameMap[name] || name
    }
    
    // 最终选中状态的颜色 - 蓝紫色系
    const highlightColors = {
      areaColor: '#7986cb',
      borderColor: '#5c6bc0',
      shadowColor: 'rgba(92, 107, 192, 0.8)'
    }
    
    // 随机选择过程中的颜色组 - 柔和多彩的配色
    const processingColors = [
      { areaColor: '#4dabf7', borderColor: '#339af0', shadowColor: 'rgba(77, 171, 247, 0.8)' }, // 蓝色
      { areaColor: '#38d9a9', borderColor: '#20c997', shadowColor: 'rgba(56, 217, 169, 0.8)' }, // 绿色
      { areaColor: '#9775fa', borderColor: '#845ef7', shadowColor: 'rgba(151, 117, 250, 0.8)' }, // 紫色
      { areaColor: '#ffa94d', borderColor: '#fd7e14', shadowColor: 'rgba(255, 169, 77, 0.8)' }, // 橙色
      { areaColor: '#74c0fc', borderColor: '#4dabf7', shadowColor: 'rgba(116, 192, 252, 0.8)' }, // 浅蓝色
      { areaColor: '#66d9e8', borderColor: '#22b8cf', shadowColor: 'rgba(102, 217, 232, 0.8)' }, // 青色
      { areaColor: '#da77f2', borderColor: '#cc5de8', shadowColor: 'rgba(218, 119, 242, 0.8)' }, // 粉紫色
      { areaColor: '#69db7c', borderColor: '#51cf66', shadowColor: 'rgba(105, 219, 124, 0.8)' }, // 翠绿色
      { areaColor: '#a9e34b', borderColor: '#94d82d', shadowColor: 'rgba(169, 227, 75, 0.8)' }, // 黄绿色
      { areaColor: '#ffc078', borderColor: '#ffa94d', shadowColor: 'rgba(255, 192, 120, 0.8)' }  // 浅橙色
    ]
    
    // 随机选择一种颜色或使用高亮颜色
    const colorIndex = Math.floor(Math.random() * processingColors.length)
    const randomColor = province && !shouldHighlight 
      ? processingColors[colorIndex] // 选择过程中使用随机颜色
      : highlightColors // 最终选中状态使用高亮颜色
    
    // 设置中国地图的配置
    setMapOption({
      backgroundColor: '#f5f8fa', // 背景色
      title: {
        text: '中国地图',
        left: 'center', // 标题居中
        top: 20,
        textStyle: {
          color: '#2c3e50',
          fontSize: 24,
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)' // 文字阴影
        }
      },
      tooltip: {
        trigger: 'item', // 提示框触发类型
        formatter: '{b}', // 提示框格式
        backgroundColor: 'rgba(44,62,80,0.85)',
        borderColor: '#fff',
        borderWidth: 2,
        padding: [8, 12],
        textStyle: {
          color: '#fff',
          fontSize: 14
        }
      },
      series: [{
        name: '中国地图',
        type: 'map', // 图表类型为地图
        map: 'china', // 使用注册的中国地图
        roam: true, // 允许缩放和平移
        scaleLimit: {
          min: 1.5, // 最小缩放比例，放大地图
          max: 5 // 最大缩放比例
        },
        zoom: 1.5, // 初始缩放比例，放大地图
        selectedMode: true, // 允许选择模式
        label: {
          show: true, // 显示地名
          color: '#2c3e50',
          fontSize: 10,
          fontWeight: 500
        },
        itemStyle: {
          areaColor: '#e8f4f8', // 区域颜色
          borderColor: '#a3d8f4', // 边界颜色
          borderWidth: 1.5,
          shadowColor: 'rgba(0,0,0,0.15)',
          shadowBlur: 8
        },
        emphasis: {
          // 鼠标悬停时的样式
          disabled: false,
          itemStyle: {
            areaColor: '#ffd6a5',
            borderColor: '#ffab4c',
            borderWidth: 2.5,
            shadowColor: 'rgba(255, 171, 76, 0.7)',
            shadowBlur: 35,
            shadowOffsetX: 2,
            shadowOffsetY: 2
          },
          label: {
            show: true,
            color: '#2c3e50',
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        select: {
          disabled: true // 禁用选择效果，使用自定义高亮效果
        },
        // 如果有选中省份，则添加该省份的特殊样式配置
        data: province ? [{
          name: getMapName(province), // 省份全名
          itemStyle: {
            // 使用随机色或高亮色
            areaColor: randomColor.areaColor,
            borderColor: randomColor.borderColor,
            borderWidth: 2,
            shadowColor: randomColor.shadowColor,
            shadowBlur: 45,
            shadowOffsetX: 3,
            shadowOffsetY: 3
          },
          emphasis: {
            itemStyle: {
              areaColor: randomColor.areaColor,
              borderColor: randomColor.borderColor,
              borderWidth: 2.5,
              shadowColor: randomColor.shadowColor,
              shadowBlur: 50
            }
          },
          label: {
            show: true,
            color: '#fff',
            fontSize: shouldHighlight ? 18 : 16, // 最终选中状态字体更大
            fontWeight: 'bold',
            textShadow: '2px 2px 6px rgba(0,0,0,0.4)' // 文字阴影
          }
        }] : [], // 没有选中省份时为空数组
        // 地图动画设置
        animation: true,
        animationDuration: 600,
        animationEasing: 'elasticOut',
        animationDelay: (idx) => idx * 100,
        animationDurationUpdate: 450,
        animationEasingUpdate: 'circularInOut'
      }]
    })
  }

  // 获取当前选中省份的城市列表
  const getProvinceCities = () => {
    return majorCities.filter(city => city.province === selectedProvince)
      .map(city => city.name);
  };
  
  // 处理城市选择
  const handleCitySelect = (cityName) => {
    // 确保用户已经选择了省份
    if (!selectedProvince) {
        alert('请先选择省份！');
        return;
    }
    setSelectedCity(cityName);
    // 如果有其他与城市选择相关的逻辑可以在这里添加
  };

  // 在处理地图点击事件中，添加显示城市选择器的逻辑
  const handleMapClick = (params) => {
    // 如果正在随机选择城市中，则不处理点击事件
    if (isCitySpinning) return
    
    // 获取点击的区域名称
    const clickedAreaName = params.name
    // 将省份全名转换为简称
    const provinceName = provinceNameMap[clickedAreaName]
    
    if (provinceName) {
      // 更新选中的省份
      setSelectedProvince(provinceName)
      // 标记为最终选择
      setIsFinalSelection(true)
      // 清除已选城市（如果有）
      setSelectedCity('')
      // 更新地图，高亮显示选中的省份
      updateMapOption(provinceName, true)
      // 显示城市选择器
      setShowCitySelector(true)
    }
  }

  // 开始自动轮播
  const startAutoPlay = () => {
    if (isAutoPlaying) return
    setIsAutoPlaying(true)
    setShowProvinceMap(true)
    
    const provinces = Object.keys(provinceCodeMap)
    let currentIndex = 0
    let currentProvince = provinces[0]
    
    // 初始化第一个省份的地图
    setSelectedProvince(currentProvince)
    updateMapOption(currentProvince, false)
    loadProvinceMap(currentProvince)
    
    // 省份轮播
    const timer = setInterval(() => {
      // 等待上一个省份地图加载完成
      if (isProvinceMapLoading) return
      
      currentIndex = (currentIndex + 1) % provinces.length
      currentProvince = provinces[currentIndex]
      
      // 更新省份和地图
      setSelectedProvince(currentProvince)
      updateMapOption(currentProvince, false)
      loadProvinceMap(currentProvince)
      
      // 获取当前省份的城市
      const citiesInProvince = majorCities.filter(city => city.province === currentProvince)
      if (citiesInProvince.length > 0) {
        // 随机选择一个城市
        const randomCity = citiesInProvince[Math.floor(Math.random() * citiesInProvince.length)]
        setSelectedCity(randomCity.name)
      }
    }, 500) // 每0.5秒切换一次
    
    setAutoPlayTimer(timer)
  }

  // 添加倒计时状态
  const [countdown, setCountdown] = useState(20)

  // 随机选择城市函数
  const handleRandomSelectCity = () => {
    // 如果正在选择中，则不执行
    if (isCitySpinning) return
    
    // 设置状态为选择中
    setIsCitySpinning(true)
    setSelectedCity('')
    setCountdown(20) // 初始化倒计时
    
    // 动画总步数
    const maxCount = 200
    let currentStep = 0
    
    // 随机选择一个城市
    const finalCity = majorCities[Math.floor(Math.random() * majorCities.length)]
    
    // 创建更长的城市显示序列，确保动画足够长
    let displayCities = []
    
    // 添加5轮完整的城市洗牌
    for (let i = 0; i < 5; i++) {
      const shuffledCities = [...majorCities].sort(() => Math.random() - 0.5)
      displayCities = [...displayCities, ...shuffledCities]
    }
    
    // 动画开始时间
    const startTime = Date.now()
    const totalDuration = 20000 // 20秒
    
    // 倒计时定时器
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // 动画函数
    const animate = () => {
      const currentTime = Date.now()
      const elapsedTime = currentTime - startTime
      
      // 当前进度比例
      const progress = currentStep / maxCount
      
      // 最后15%的阶段开始频繁展示最终城市
      const showFinalCity = progress > 0.85
      
      // 根据进度确定当前显示的城市
      let currentCity
      if (showFinalCity && Math.random() < 0.3 + progress * 0.7) {
        // 根据进度增加最终城市出现的概率
        currentCity = finalCity
      } else {
        // 正常轮换显示城市
        currentCity = displayCities[currentStep % displayCities.length]
      }
      
      // 更新选中城市
      setSelectedCity(`${currentCity.name} (${countdown}秒)`)
      
      // 如果还需要同时显示该城市所在的省份
      if (currentCity.province) {
        setSelectedProvince(currentCity.province)
        setIsFinalSelection(true)
        updateMapOption(currentCity.province, showFinalCity && currentStep >= maxCount - 10)
      }
      
      // 如果还未到20秒，继续动画
      if (elapsedTime < totalDuration) {
        currentStep++
        
        // 根据进度调整动画速度，实现渐进式减速效果
        let duration
        if (progress < 0.3) {
          // A: 快速轮换
          duration = Math.max(50, 100 - progress * 100)
        } else if (progress < 0.7) {
          // B: 中速
          duration = 80 + Math.sin((progress - 0.3) * 5) * 20
        } else if (progress < 0.85) {
          // C: 开始减速
          duration = 100 + (progress - 0.7) * 300
        } else {
          // D: 明显减速
          duration = 200 + (progress - 0.85) * 1000
        }
        
        // 设置下一步动画的延时
        setTimeout(animate, duration)
      } else {
        // 动画结束，最终选择
        clearInterval(countdownTimer) // 清除倒计时定时器
        setSelectedCity(finalCity.name)
        setSelectedProvince(finalCity.province)
        updateMapOption(finalCity.province, true)
        setIsCitySpinning(false)
        setCountdown(0) // 重置倒计时
        // 加载省份地图
        loadProvinceMap(finalCity.province)
      }
    }

    // 开始动画
    animate()
  }

  // 清除当前选择并停止轮播
  const handleClearSelection = () => {
    // 停止轮播定时器
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer)
      setAutoPlayTimer(null)
      // 保持当前选中的省份和城市
      setIsFinalSelection(true)
      // 加载省份地图
      if (selectedProvince) {
        loadProvinceMap(selectedProvince)
      }
    } else {
      // 如果不是从轮播状态停止，则重置所有状态
      setSelectedProvince('')
      setSelectedCity('')
      setIsFinalSelection(false)
      setShowProvinceMap(false)
    }
    
    setIsAutoPlaying(false)
    setIsCitySpinning(false)
    
    // 更新地图显示
    if (selectedProvince) {
      updateMapOption(selectedProvince, true)
    } else {
      updateMapOption()
    }
  }

  // 随机选择美食函数
  const handleRandomSelectFood = () => {
    // 如果正在选择中，则不执行
    if (isFoodSpinning) return
    
    // 设置状态为选择中
    setIsFoodSpinning(true)
    setSelectedFood(null)
    setFoodCountdown(10) // 初始化倒计时为10秒
    setShowFoodResult(false)
    
    // 动画总步数
    const maxCount = 100
    let currentStep = 0
    
    // 随机选择一个美食
    const finalFood = foodData[Math.floor(Math.random() * foodData.length)]
    
    // 创建更长的美食显示序列，确保动画足够长
    let displayFoods = []
    
    // 添加5轮完整的美食洗牌
    for (let i = 0; i < 5; i++) {
      const shuffledFoods = [...foodData].sort(() => Math.random() - 0.5)
      displayFoods = [...displayFoods, ...shuffledFoods]
    }
    
    // 动画开始时间
    const startTime = Date.now()
    const totalDuration = 10000 // 10秒
    
    // 倒计时定时器
    const countdownTimer = setInterval(() => {
      setFoodCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // 动画函数
    const animate = () => {
      const currentTime = Date.now()
      const elapsedTime = currentTime - startTime
      
      // 当前进度比例
      const progress = currentStep / maxCount
      
      // 最后15%的阶段开始频繁展示最终美食
      const showFinalFood = progress > 0.85
      
      // 根据进度确定当前显示的美食
      let currentFood
      if (showFinalFood && Math.random() < 0.3 + progress * 0.7) {
        // 根据进度增加最终美食出现的概率
        currentFood = finalFood
      } else {
        // 正常轮换显示美食
        currentFood = displayFoods[currentStep % displayFoods.length]
      }
      
      // 更新选中美食
      setSelectedFood(currentFood)
      
      // 如果还未到10秒，继续动画
      if (elapsedTime < totalDuration) {
        currentStep++
        
        // 根据进度调整动画速度，实现渐进式减速效果
        let duration
        if (progress < 0.3) {
          // A: 快速轮换
          duration = Math.max(50, 100 - progress * 100)
        } else if (progress < 0.7) {
          // B: 中速
          duration = 80 + Math.sin((progress - 0.3) * 5) * 20
        } else if (progress < 0.85) {
          // C: 开始减速
          duration = 100 + (progress - 0.7) * 300
        } else {
          // D: 明显减速
          duration = 200 + (progress - 0.85) * 1000
        }
        
        // 设置下一步动画的延时
        setTimeout(animate, duration)
      } else {
        // 动画结束，最终选择
        clearInterval(countdownTimer) // 清除倒计时定时器
        setSelectedFood(finalFood)
        setIsFoodSpinning(false)
        setFoodCountdown(0) // 重置倒计时
        setShowFoodResult(true) // 显示最终结果弹窗
      }
    }

    // 开始动画
    animate()
  }

  // 切换页面函数
  const switchPage = (page) => {
    setCurrentPage(page)
  }

  // 关闭美食结果弹窗
  const closeFoodResult = () => {
    setShowFoodResult(false)
  }

  // 渲染组件
  return (
    <div className="container">
      {/* 页面头部 */}
      <header className="app-header">
        <h1>{currentPage === 'map' ? '中国地图省份城市选择器' : '中国特色美食选择器'}</h1>
          {currentPage === 'food' && <p className="food-description">随机选择一种中国特色美食，发现舌尖上的中国！</p>}
        {/* 导航栏 */}
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${currentPage === 'map' ? 'active' : ''}`}
            onClick={() => switchPage('map')}
          >
            地图选择器
          </button>
          <button 
            className={`nav-tab ${currentPage === 'food' ? 'active' : ''}`}
            onClick={() => switchPage('food')}
          >
            美食选择器
          </button>
        </div>
      </header>

      {/* 地图选择器页面 */}
      {currentPage === 'map' && (
        <>
          {/* 地图容器 */}
          <div className="echarts-container">
            {/* 中国地图 */}
            <div className="china-map-container">
              <ReactECharts
                option={mapOption}
                style={{ height: '100%', width: '100%' }}
                onEvents={{
                  'click': handleMapClick
                }}
              />
            </div>
            
            {/* 省份地图 */}
            {showProvinceMap && (
              <div className="province-map-container visible">
                {isProvinceMapLoading ? (
                  <div className="province-map-loading">
                    {/*正在加载地图...*/}
                  </div>
                ) : (
                  <ReactECharts
                    option={provinceMapOption}
                    style={{ height: '100%', width: '100%' }}
                  />
                )}
              </div>
            )}
          </div>

          {/* 按钮组 */}
          <div className="button-group">
            {/* 随机选择按钮 */}
            <button
              className={`select-button ${isCitySpinning ? 'spinning' : ''}`}
              onClick={isCitySpinning ? handleClearSelection : handleRandomSelectCity}
              disabled={isAutoPlaying}
            >
              {isCitySpinning ? `随机选择中 (${countdown}秒)` : '随机选择'}
            </button>

            {/* 轮播按钮 */}
            <button
              className={`select-button ${isAutoPlaying ? 'playing' : ''}`}
              onClick={isAutoPlaying ? handleClearSelection : startAutoPlay}
              disabled={isCitySpinning}
            >
              {isAutoPlaying ? '停止轮播' : '开始轮播'}
            </button>
          </div>

          {/* 重新选择按钮 */}
          {(selectedProvince || selectedCity || isAutoPlaying || isCitySpinning) && (
            <button
              className="clear-button"
              onClick={handleClearSelection}
              disabled={isCitySpinning}
            >
              重新选择
            </button>
          )}
          {/* 城市选择器 */}
          {showCitySelector && selectedProvince && (
            <div className="city-selector">
              <h3>{selectedProvince}的城市：</h3>
              <div className="city-list">
                {getProvinceCities().length > 0 ? (
                  getProvinceCities().map((city, index) => (
                    <button 
                      key={index} 
                      className={`city-item ${selectedCity === city ? 'selected' : ''}`}
                      onClick={() => handleCitySelect(city)}
                    >
                      {city}
                    </button>
                  ))
                ) : (
                  <p>暂无城市数据</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 美食选择器页面 */}
      {currentPage === 'food' && (
        <div className="food-selector-container">
          
          {/* 美食卡片网格 */}
          <div className="food-grid">
            {foodData.map((food) => (
              <div 
                key={food.id} 
                className={`food-card ${selectedFood?.id === food.id ? 'selected' : ''}`}
                onClick={() => !isFoodSpinning && setSelectedFood(food)}
              >
                <div className="food-image-container">
                  <img src={`/china-map-selector${food.image}`} alt={food.name} className="food-image" />
                </div>
                <div className="food-info">
                  <h3 className="food-name">{food.name}</h3>
                  <p className="food-province">{food.province}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* 美食选择按钮 */}
          <div className="food-button-group">
            <button 
              className="food-select-button"
              onClick={handleRandomSelectFood}
              disabled={isFoodSpinning}
            >
              {isFoodSpinning ? `随机选择中 (${foodCountdown}秒)` : '随机选择美食'}
            </button>
          </div>
          
          {/* 美食结果弹窗 */}
          {showFoodResult && selectedFood && (
            <div className="food-result-modal">
              <div className="food-result-content">
                <h2>恭喜您选中了：</h2>
                <div className="selected-food-card">
                  <div className="selected-food-image-container">
                    <img src={`/china-map-selector${selectedFood.image}`} alt={selectedFood.name} className="selected-food-image" />
                  </div>
                  <h3>{selectedFood.name}</h3>
                  <p className="selected-food-province">{selectedFood.province}</p>
                  <p className="selected-food-description">{selectedFood.description}</p>
                </div>
                <button className="close-result-button" onClick={closeFoodResult}>关闭</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App