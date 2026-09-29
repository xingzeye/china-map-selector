import { useState, useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import './App.css'

const visibleMapLabels = new Set(['新疆', '西藏', '青海', '内蒙古', '黑龙江', '四川', '云南', '广东', '山东', '陕西'])
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

function App() {
  // 状态管理变量定义
  const [currentPage, setCurrentPage] = useState('map') // 当前显示的页面：'map' 或 'food'
  const [mapOption, setMapOption] = useState({}) // 中国地图配置
  const [provinceMapOption, setProvinceMapOption] = useState({}) // 省份地图配置
  const [selectedProvince, setSelectedProvince] = useState('') // 当前选中的省份
  const [showProvinceMap, setShowProvinceMap] = useState(false) // 是否显示省份地图
  const [isProvinceMapLoading, setIsProvinceMapLoading] = useState(false) // 省份地图是否加载中
  const [provinceMapError, setProvinceMapError] = useState(false)
  const [isFinalSelection, setIsFinalSelection] = useState(false) // 是否为最终选择结果
  // 新增状态管理变量
  const [isCitySpinning, setIsCitySpinning] = useState(false) // 是否正在随机选择城市中
  const [selectedCity, setSelectedCity] = useState('') // 当前选中的城市
  const [showCitySelector, setShowCitySelector] = useState(false) // 是否显示城市选择器
  const [isAutoPlaying, setIsAutoPlaying] = useState(false) // 是否正在自动轮播
  const [autoPlayTimer, setAutoPlayTimer] = useState(null) // 轮播定时器
  
  // 美食选择器相关状态
  const [foodData, setFoodData] = useState([]) // 美食数据
  const [selectedFood, setSelectedFood] = useState(null) // 当前选中的美食
  const [isFoodSpinning, setIsFoodSpinning] = useState(false) // 是否正在随机选择美食
  const [foodCountdown, setFoodCountdown] = useState(4) // 美食选择倒计时
  const [showFoodResult, setShowFoodResult] = useState(false) // 是否显示最终选中的美食结果
  const closeResultRef = useRef(null)
  const provinceRequestId = useRef(0)
  const citySpinTimeoutRef = useRef(null)
  const cityCountdownTimerRef = useRef(null)
  const foodSpinTimeoutRef = useRef(null)
  const foodCountdownTimerRef = useRef(null)
  const autoPlayTimerRef = useRef(null)

  useEffect(() => () => {
    clearTimeout(citySpinTimeoutRef.current)
    clearInterval(cityCountdownTimerRef.current)
    clearTimeout(foodSpinTimeoutRef.current)
    clearInterval(foodCountdownTimerRef.current)
    clearInterval(autoPlayTimerRef.current)
  }, [])

  useEffect(() => {
    if (!showFoodResult) return undefined

    const previousFocus = document.activeElement
    closeResultRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowFoodResult(false)
    }
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus?.()
    }
  }, [showFoodResult])

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
    fetch(publicAsset('china.json'))
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
    fetch(publicAsset('food_data.json'))
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
    const requestId = ++provinceRequestId.current
    // 获取省份编码
    const provinceCode = provinceCodeMap[province]
    if (!provinceCode) {
      setIsProvinceMapLoading(false)
      setProvinceMapError(true)
      return
    }

    // 设置加载状态
    setIsProvinceMapLoading(true)
    setProvinceMapError(false)
    setShowProvinceMap(true)

    // 从本地加载省份地图GeoJSON数据
    fetch(publicAsset(`province-maps/${province}.json`))
      .then(response => {
        if (!response.ok) {
          throw new Error('网络响应异常')
        }
        return response.json()
      })
      .then(geoJson => {
        if (requestId !== provinceRequestId.current) return
        if (!geoJson || !geoJson.features) {
          throw new Error('地图数据格式异常')
        }
        // 注册省份地图到ECharts
        echarts.registerMap(province, geoJson)
        
        // 设置省份地图配置
        setProvinceMapOption({
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'item',
            formatter: '{b}',
            backgroundColor: '#102c39',
            borderColor: '#77c9c6',
            borderWidth: 1,
            padding: [9, 13],
            textStyle: {
              color: '#f4fbf9',
              fontSize: 13
            }
          },
          series: [{
            name: province,
            type: 'map',
            map: province,
            roam: true,
            scaleLimit: { min: 0.85, max: 5 },
            zoom: 1,
            label: {
              show: false,
              color: '#d7f1eb',
              fontSize: 10,
              fontWeight: 600,
              textBorderColor: '#123d4a',
              textBorderWidth: 2
            },
            itemStyle: {
              areaColor: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                { offset: 0, color: '#287f8d' },
                { offset: 1, color: '#125166' }
              ]),
              borderColor: '#8adad5',
              borderWidth: 1.2,
              shadowColor: '#082633',
              shadowBlur: 12,
              shadowOffsetY: 8
            },
            emphasis: {
              itemStyle: {
                areaColor: '#e7b66e',
                borderColor: '#fff1cf',
                borderWidth: 2,
                shadowColor: 'rgba(246, 185, 98, 0.48)',
                shadowBlur: 18,
                shadowOffsetY: 8
              },
              label: {
                show: true,
                color: '#173341',
                fontSize: 12,
                fontWeight: 'bold'
              }
            },
            animation: true,
            animationDuration: 500,
            animationEasing: 'cubicOut',
            animationDurationUpdate: 320
          }]
        })
        // 结束加载状态
        setIsProvinceMapLoading(false)
        setProvinceMapError(false)
      })
      .catch(error => {
        if (requestId !== provinceRequestId.current) return
        console.error('加载省份地图失败:', error)
        setIsProvinceMapLoading(false)
        setProvinceMapError(true)
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
    
    // 暖金色选中态与深色地图形成清晰对比
    const highlightColors = {
      areaColor: '#f0bb70',
      borderColor: '#fff1ca',
      shadowColor: 'rgba(245, 187, 105, 0.6)'
    }
    
    // 随机探索时的过渡色
    const processingColors = [
      { areaColor: '#8bd5cd', borderColor: '#d9fff3', shadowColor: 'rgba(139, 213, 205, 0.5)' },
      { areaColor: '#90b9e5', borderColor: '#deefff', shadowColor: 'rgba(144, 185, 229, 0.5)' },
      { areaColor: '#e5bd86', borderColor: '#fff1d6', shadowColor: 'rgba(229, 189, 134, 0.5)' },
      { areaColor: '#a6d69a', borderColor: '#e8ffdd', shadowColor: 'rgba(166, 214, 154, 0.5)' }
    ]
    
    // 随机选择一种颜色或使用高亮颜色
    const colorIndex = Math.floor(Math.random() * processingColors.length)
    const randomColor = province && !shouldHighlight 
      ? processingColors[colorIndex] // 选择过程中使用随机颜色
      : highlightColors // 最终选中状态使用高亮颜色
    
    // 设置中国地图的配置
    setMapOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}',
        backgroundColor: '#102c39',
        borderColor: '#77c9c6',
        borderWidth: 1,
        padding: [9, 13],
        textStyle: {
          color: '#f4fbf9',
          fontSize: 13
        }
      },
      series: [{
        name: '中国地图',
        type: 'map',
        map: 'china',
        roam: true,
        scaleLimit: { min: 0.85, max: 4 },
        zoom: 1.28,
        selectedMode: false,
        label: {
          show: true,
          formatter: ({ name }) => {
            const shortName = provinceNameMap[name] || name
            return visibleMapLabels.has(shortName) || shortName === province ? shortName : ''
          },
          color: '#ddf5ef',
          fontSize: 10,
          fontWeight: 600,
          textBorderColor: '#103c49',
          textBorderWidth: 2
        },
        itemStyle: {
          areaColor: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
            { offset: 0, color: '#287f8d' },
            { offset: 1, color: '#125166' }
          ]),
          borderColor: '#8adad5',
          borderWidth: 1.1,
          shadowColor: '#041d2a',
          shadowBlur: 16,
          shadowOffsetY: 11
        },
        emphasis: {
          disabled: false,
          itemStyle: {
            areaColor: '#f0bb70',
            borderColor: '#fff1ca',
            borderWidth: 2,
            shadowColor: 'rgba(245, 187, 105, 0.65)',
            shadowBlur: 20,
            shadowOffsetY: 10
          },
          label: {
            show: true,
            color: '#173341',
            fontSize: 13,
            fontWeight: 'bold'
          }
        },
        select: {
          disabled: true
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
            shadowBlur: 22,
            shadowOffsetY: 13
          },
          emphasis: {
            itemStyle: {
              areaColor: randomColor.areaColor,
              borderColor: randomColor.borderColor,
              borderWidth: 2.5,
              shadowColor: randomColor.shadowColor,
              shadowBlur: 25,
              shadowOffsetY: 11
            }
          },
          label: {
            show: true,
            color: '#173341',
            fontSize: shouldHighlight ? 15 : 13,
            fontWeight: 'bold',
            textBorderWidth: 0
          }
        }] : [], // 没有选中省份时为空数组
        // 地图动画设置
        animation: true,
        animationDuration: 500,
        animationEasing: 'cubicOut',
        animationDurationUpdate: 320
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
    if (isCitySpinning || isAutoPlaying) return
    
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
    setIsFinalSelection(false)
    setShowProvinceMap(true)
    setSelectedCity('北京市')
    
    const provinces = Object.keys(provinceCodeMap)
    let currentIndex = 0
    let currentProvince = provinces[0]
    
    // 初始化第一个省份的地图
    setSelectedProvince(currentProvince)
    updateMapOption(currentProvince, false)
    loadProvinceMap(currentProvince)
    
    // 省份轮播
    const timer = setInterval(() => {
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
    }, 1800)
    
    autoPlayTimerRef.current = timer
    setAutoPlayTimer(timer)
  }

  const stopAutoPlay = () => {
    clearInterval(autoPlayTimerRef.current)
    autoPlayTimerRef.current = null
    setAutoPlayTimer(null)
    setIsAutoPlaying(false)
    provinceRequestId.current += 1
    setIsFinalSelection(true)
    updateMapOption(selectedProvince, true)
  }

  // 添加倒计时状态
  const [countdown, setCountdown] = useState(5)

  // 随机选择城市函数
  const handleRandomSelectCity = () => {
    // 如果正在选择中，则不执行
    if (isCitySpinning) return
    
    // 设置状态为选择中
    setIsCitySpinning(true)
    setSelectedCity('')
    setCountdown(5)
    setIsFinalSelection(false)
    setShowProvinceMap(false)
    setIsProvinceMapLoading(false)
    provinceRequestId.current += 1
    
    // 动画总步数
    const maxCount = 50
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
    const totalDuration = 5000
    
    // 倒计时定时器
    cityCountdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(cityCountdownTimerRef.current)
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
      setSelectedCity(`${currentCity.name} (${Math.max(1, Math.ceil((totalDuration - elapsedTime) / 1000))}秒)`)
      
      // 如果还需要同时显示该城市所在的省份
      if (currentCity.province) {
        setSelectedProvince(currentCity.province)
        updateMapOption(currentCity.province, showFinalCity && currentStep >= maxCount - 10)
      }
      
      // 在五秒内继续动画
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
        citySpinTimeoutRef.current = setTimeout(animate, duration)
      } else {
        // 动画结束，最终选择
        clearInterval(cityCountdownTimerRef.current)
        setSelectedCity(finalCity.name)
        setSelectedProvince(finalCity.province)
        setIsFinalSelection(true)
        updateMapOption(finalCity.province, true)
        setIsCitySpinning(false)
        setCountdown(0)
      }
    }

    // 开始动画
    animate()
  }

  // 清除当前选择并停止轮播
  const handleClearSelection = () => {
    clearTimeout(citySpinTimeoutRef.current)
    clearInterval(cityCountdownTimerRef.current)
    clearInterval(autoPlayTimerRef.current)
    autoPlayTimerRef.current = null
    provinceRequestId.current += 1
    setAutoPlayTimer(null)
    setSelectedProvince('')
    setSelectedCity('')
    setIsFinalSelection(false)
    setShowProvinceMap(false)
    setIsProvinceMapLoading(false)
    setProvinceMapError(false)
    setIsAutoPlaying(false)
    setIsCitySpinning(false)
    setCountdown(0)
    updateMapOption()
  }

  // 随机选择美食函数
  const handleRandomSelectFood = () => {
    // 如果正在选择中，则不执行
    if (isFoodSpinning) return
    
    // 设置状态为选择中
    setIsFoodSpinning(true)
    setSelectedFood(null)
    setFoodCountdown(4)
    setShowFoodResult(false)
    
    // 动画总步数
    const maxCount = 40
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
    const totalDuration = 4000
    
    // 倒计时定时器
    foodCountdownTimerRef.current = setInterval(() => {
      setFoodCountdown(prev => {
        if (prev <= 1) {
          clearInterval(foodCountdownTimerRef.current)
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
      
      // 在四秒内继续动画
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
        foodSpinTimeoutRef.current = setTimeout(animate, duration)
      } else {
        // 动画结束，最终选择
        clearInterval(foodCountdownTimerRef.current)
        setSelectedFood(finalFood)
        setIsFoodSpinning(false)
        setFoodCountdown(0) // 重置倒计时
        setShowFoodResult(true) // 显示最终结果弹窗
      }
    }

    // 开始动画
    animate()
  }

  const stopFoodSelection = () => {
    clearTimeout(foodSpinTimeoutRef.current)
    clearInterval(foodCountdownTimerRef.current)
    setIsFoodSpinning(false)
    setFoodCountdown(0)
    setSelectedFood(null)
  }

  // 切换页面函数
  const switchPage = (page) => {
    if (page === currentPage) return
    if (isCitySpinning) handleClearSelection()
    if (autoPlayTimer) stopAutoPlay()
    if (isFoodSpinning) stopFoodSelection()
    setCurrentPage(page)
  }

  // 关闭美食结果弹窗
  const closeFoodResult = () => {
    setShowFoodResult(false)
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">山</span>
          <span className="brand-copy">
            <span className="brand-overline">CHINA ATLAS</span>
            <strong>山海之间</strong>
          </span>
        </div>

        <nav className="nav-tabs" aria-label="功能导航">
          <button type="button" className={`nav-tab ${currentPage === 'map' ? 'active' : ''}`} aria-pressed={currentPage === 'map'} onClick={() => switchPage('map')}>
            探索地图
          </button>
          <button type="button" className={`nav-tab ${currentPage === 'food' ? 'active' : ''}`} aria-pressed={currentPage === 'food'} onClick={() => switchPage('food')}>
            风味图鉴
          </button>
        </nav>

        <span className="header-note">一张地图 · 无限可能</span>
      </header>

      <main className="site-main">
        <section className="page-intro">
          <div>
            <p className="eyebrow">INTERACTIVE CHINA ATLAS <span>/</span> 探索中国</p>
            <h1>{currentPage === 'map' ? <>下一站，<em>从这里出发。</em></> : <>尝一口，<em>发现新风味。</em></>}</h1>
            <p className="intro-description">
              {currentPage === 'map' ? '轻触地图上的省份，看看城市与风景；或者让一次随机选择，带你认识新的目的地。' : '从熟悉的味道到新的灵感，翻开这份轻松的美食图鉴，让今天的选择更有趣。'}
            </p>
          </div>
          <div className="intro-count" aria-label={currentPage === 'map' ? '31个可探索省级区域' : `${foodData.length}道美食灵感`}>
            <strong>{currentPage === 'map' ? '31' : String(foodData.length).padStart(2, '0')}</strong>
            <span>{currentPage === 'map' ? '个可探索地区' : '道风味灵感'}</span>
          </div>
        </section>

        {currentPage === 'map' && (
          <section className="explorer-layout" aria-label="地图探索区">
            <article className="map-stage">
              <div className="stage-header">
                <div>
                  <p className="section-index">01 / EXPLORE</p>
                  <h2>中国地理图</h2>
                </div>
                <span className="stage-status"><span aria-hidden="true" />可交互地图</span>
              </div>
              <div className="map-surface">
                <span className="map-compass" aria-hidden="true">N <span>↑</span></span>
                <span className="map-watermark" aria-hidden="true">CHINA · ATLAS</span>
                <div className="china-map-container" aria-label="中国地图，点击省份查看详情">
                  <ReactECharts
                    option={mapOption}
                    style={{ height: '100%', width: '100%' }}
                    onEvents={{ click: handleMapClick }}
                  />
                </div>
              </div>
              <div className="stage-footer">
                <span>拖动或滚轮浏览 · 点击省份查看详情</span>
                <span className="footer-coordinate">MAP / CN</span>
              </div>
            </article>

            <aside className="explore-sidebar">
              <section className="action-panel">
                <p className="section-index">02 / DISCOVER</p>
                <h2>下一站，交给地图</h2>
                <p className="panel-description">自己挑一座城市，或开启一次充满惊喜的随机探索。</p>
                <div className="button-group">
                  <button type="button" className={`select-button ${isCitySpinning ? 'spinning' : ''}`} onClick={isCitySpinning ? handleClearSelection : handleRandomSelectCity} disabled={isAutoPlaying}>
                    <span aria-hidden="true">✦</span> {isCitySpinning ? `停止探索 · ${countdown}秒` : '随机探索'}
                  </button>
                  <button type="button" className={`tour-button ${isAutoPlaying ? 'playing' : ''}`} onClick={isAutoPlaying ? stopAutoPlay : startAutoPlay} disabled={isCitySpinning}>
                    <span aria-hidden="true">{isAutoPlaying ? 'Ⅱ' : '▷'}</span> {isAutoPlaying ? '停止轮播' : '省份轮播'}
                  </button>
                </div>
                {(selectedProvince || selectedCity || isAutoPlaying) && (
                  <button type="button" className="clear-button" onClick={handleClearSelection}>重新选择 <span aria-hidden="true">↗</span></button>
                )}
              </section>

              <section className={`selection-panel ${selectedProvince ? 'has-selection' : ''}`} aria-live="polite">
                <div className="panel-row"><p className="section-index">当前目的地</p><span className="selection-dot" aria-hidden="true" /></div>
                <h2>{selectedProvince || '等待一次点击'}</h2>
                <p>{selectedCity ? `已选城市 · ${selectedCity}` : selectedProvince ? '在下方选择一座城市，继续你的探索。' : '地图上的每一个区域，都可能是下一段旅程的开始。'}</p>
              </section>

              <section className="detail-panel">
                <div className="panel-row"><p className="section-index">03 / LOCAL VIEW</p><span className="detail-tag">省份详情</span></div>
                {showProvinceMap && selectedProvince ? (
                  <>
                    <h3>{selectedProvince} · 城市一览</h3>
                    <div className="province-map-container">
                      {!provinceMapError && provinceMapOption.series && <ReactECharts option={provinceMapOption} style={{ height: '100%', width: '100%' }} />}
                      {isProvinceMapLoading && <div className="province-map-loading">地图加载中…</div>}
                      {provinceMapError && <div className="province-map-error" role="status">地图暂时无法加载<button type="button" onClick={() => loadProvinceMap(selectedProvince)}>重试</button></div>}
                    </div>
                    {showCitySelector && !isCitySpinning && !isAutoPlaying && (
                      <div className="city-list" aria-label={`${selectedProvince}城市列表`}>
                        {getProvinceCities().length > 0 ? getProvinceCities().map((city) => (
                          <button type="button" key={city} className={`city-item ${selectedCity === city ? 'selected' : ''}`} onClick={() => handleCitySelect(city)} disabled={isCitySpinning}>
                            {city}
                          </button>
                        )) : <p className="empty-city">暂无城市数据</p>}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="detail-empty">
                    <span className="empty-symbol" aria-hidden="true">◇</span>
                    <h3>发现一个地方</h3>
                    <p>选择地图上的省份后，这里会展开当地地图与城市。</p>
                  </div>
                )}
              </section>
            </aside>
          </section>
        )}

        {currentPage === 'food' && (
          <section className="food-layout" aria-label="风味图鉴">
            <aside className="food-feature">
              <p className="section-index">01 / FOOD NOTES</p>
              <h2>让味蕾<br />决定路线。</h2>
              <p className="panel-description">不知道吃什么？从这份图鉴里挑一道，或让随机选择替你做决定。</p>
              <button type="button" className="food-select-button" onClick={isFoodSpinning ? stopFoodSelection : handleRandomSelectFood} disabled={foodData.length === 0}>
                <span aria-hidden="true">✦</span> {isFoodSpinning ? `停止挑选 · ${foodCountdown}秒` : '随机挑一道'}
              </button>
              {selectedFood && (
                <div className="food-current" aria-live={isFoodSpinning ? 'off' : 'polite'}>
                  <span className="food-current-label">此刻的风味</span>
                  <div className="food-current-body">
                    <img src={publicAsset(selectedFood.image)} alt="" decoding="async" />
                    <div><strong>{selectedFood.name}</strong><p>{selectedFood.description}</p></div>
                  </div>
                </div>
              )}
            </aside>
            <div className="food-gallery">
              <div className="food-gallery-header"><div><p className="section-index">02 / THE COLLECTION</p><h2>风味图鉴</h2></div><span>共 {foodData.length} 道</span></div>
              <div className="food-grid">
                {foodData.map((food) => (
                  <button type="button" key={food.id} className={`food-card ${selectedFood?.id === food.id ? 'selected' : ''}`} aria-pressed={selectedFood?.id === food.id} onClick={() => !isFoodSpinning && setSelectedFood(food)} disabled={isFoodSpinning}>
                    <span className="food-image-container">
                      <span className="food-card-number" aria-hidden="true">{String(food.id).padStart(2, '0')}</span>
                      <img src={publicAsset(food.image)} alt="" className="food-image" loading="lazy" decoding="async" />
                    </span>
                    <span className="food-info">
                      <span className="food-copy"><strong className="food-name">{food.name}</strong><span className="food-description">{food.description}</span></span>
                      <span className="food-card-arrow" aria-hidden="true">↗</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer"><span>山海之间 · 中国地图与美食选择器</span><span>© xingzeye · Northeast Electric Power University</span></footer>

      {showFoodResult && selectedFood && (
        <div className="food-result-modal" onClick={closeFoodResult}>
          <div className="food-result-content" role="dialog" aria-modal="true" aria-labelledby="food-result-title" onClick={(event) => event.stopPropagation()}>
            <button ref={closeResultRef} type="button" className="modal-close" aria-label="关闭结果弹窗" onClick={closeFoodResult}>×</button>
            <span className="section-index">TODAY'S PICK</span>
            <h2 id="food-result-title">今天就吃 <em>{selectedFood.name}</em></h2>
            <div className="selected-food-image-container"><img src={publicAsset(selectedFood.image)} alt="" className="selected-food-image" decoding="async" /></div>
            <p className="selected-food-description">{selectedFood.description}</p>
            <button type="button" className="close-result-button" onClick={closeFoodResult}>继续探索 <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
