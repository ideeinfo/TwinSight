import { createI18n } from 'vue-i18n'

const messages = {
  zh: {
    common: {
      close: '关闭',
      apply: '应用',
      cancel: '取消',
      select: '选择日期',
      add: '添加',
      multiple: '多个',
      varies: '多个',
      unnamed: '未命名',
      none: '--',
      create: '创建',
      search: '搜索',
      status: '状态'
    },
    header: {
      properties: '属性',
      rooms: '房间',
      heatmap: '热力图'
    },
    leftPanel: {
      title: '房间列表',
      search: '搜索房间...',
      noRooms: '暂无房间',
      connections: '连接',
      filters: '筛选',
      assets: '资产',
      files: '文件',
      systems: '系统',
      connect: '连接',
      streams: '数据流',
      history: '历史',
      inventory: '列表'
    },
    rightPanel: {
      properties: '属性',
      element: '元素',
      type: '类型',
      assetProperties: '资产属性',
      relationships: '关系',
      designProperties: '设计属性',
      common: '通用',
      code: '编号',
      name: '名称',
      area: '面积',
      perimeter: '周长',
      level: '楼层',
      assemblyCode: '装配代码',
      tandemCategory: 'Tandem 类别',
      selectUniformat: '选择 Uniformat',
      panel: '面板',
      rooms: '房间',
      selectRooms: '选择房间',
      parent: '父级',
      manufacturer: '制造商',
      model: '型号',
      classification: '分类',
      selectClassification: '选择分类',
      room: '房间',
      asset: '资产',
      curtainWallPanel: '幕墙嵌板',
      systemPanel: '系统面板',
      glass: '玻璃',
      curtainWall: '幕墙',
      mcCode: 'MC编码',
      omniClass21Number: 'OmniClass 21 编号',
      omniClass21Description: 'OmniClass 21 描述',
      category: '类别',
      family: '族',
      typeLabel: '类型',
      typeComments: '类型注释'
    },
    timeline: {
      live: 'LIVE',
      play: '播放',
      pause: '暂停',
      speed: '速度',
      timeRange: '时间范围',
      '24h': '24小时',
      '3d': '3天',
      '7d': '7天',
      '30d': '30天',
      custom: '自定义',
      selectDateRange: '选择日期范围',
      startDate: '开始日期',
      endDate: '结束日期'
    },
    calendar: {
      sun: '日',
      mon: '一',
      tue: '二',
      wed: '三',
      thu: '四',
      fri: '五',
      sat: '六'
    },
    chartPanel: {
      title: '数据流',
      subtitle: '实时温度监测',
      placeholder: '暂无数据流图表',
      temperature: '温度 (°C)',
      systemPanel: '系统面板',
      alert: '警报',
      alertAbove30: '警报 > 30°C',
      normal: '正常'
    },
    assetPanel: {
      assets: '资产',
      loading: '正在加载资产...',
      uncategorized: '未分类'
    }
  },
  en: {
    common: {
      close: 'Close',
      apply: 'Apply',
      cancel: 'Cancel',
      select: 'Select date',
      add: 'Add',
      multiple: 'Multiple',
      varies: 'Varies',
      unnamed: 'Unnamed',
      none: '--',
      create: 'Create',
      search: 'Search',
      status: 'Status'
    },
    header: {
      properties: 'Properties',
      rooms: 'Rooms',
      heatmap: 'Heatmap'
    },
    leftPanel: {
      title: 'Room List',
      search: 'Search rooms...',
      noRooms: 'No rooms',
      connections: 'CONNECTIONS',
      filters: 'Filters',
      assets: 'Assets',
      files: 'Files',
      systems: 'Systems',
      connect: 'Connect',
      streams: 'Streams',
      history: 'History',
      inventory: 'Inventory'
    },
    rightPanel: {
      properties: 'PROPERTIES',
      element: 'ELEMENT',
      type: 'TYPE',
      assetProperties: 'ASSET PROPERTIES',
      relationships: 'RELATIONSHIPS',
      designProperties: 'DESIGN PROPERTIES',
      common: 'Common',
      code: 'Code',
      name: 'Name',
      area: 'Area',
      perimeter: 'Perimeter',
      level: 'Level',
      assemblyCode: 'Assembly Code',
      tandemCategory: 'Tandem Category',
      selectUniformat: 'Select Uniformat',
      panel: 'Panel',
      rooms: 'Rooms',
      selectRooms: 'Select Room(s)',
      parent: 'Parent',
      manufacturer: 'Manufacturer',
      model: 'Model',
      classification: 'Classification',
      selectClassification: 'Select CAClass-20241024',
      room: 'Room',
      asset: 'Asset',
      curtainWallPanel: 'Curtain Wall Panel',
      systemPanel: 'System Panel',
      glass: 'Glass',
      curtainWall: 'Curtain Wall',
      mcCode: 'MC Code',
      omniClass21Number: 'OmniClass 21 Number',
      omniClass21Description: 'OmniClass 21 Description',
      category: 'Category',
      family: 'Family',
      typeLabel: 'Type',
      typeComments: 'Type Comments'
    },
    timeline: {
      live: 'LIVE',
      play: 'Play',
      pause: 'Pause',
      speed: 'Speed',
      timeRange: 'Time Range',
      '24h': '24 Hours',
      '3d': '3 Days',
      '7d': '7 Days',
      '30d': '30 Days',
      custom: 'Custom',
      selectDateRange: 'Select Date Range',
      startDate: 'Start Date',
      endDate: 'End Date'
    },
    calendar: {
      sun: 'Sun',
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat'
    },
    chartPanel: {
      title: 'Streams',
      subtitle: 'Real-time Temperature Monitoring',
      placeholder: 'No stream data available',
      temperature: 'Temperature (°C)',
      systemPanel: 'System Panel',
      alert: 'Alert',
      alertAbove30: 'Alert > 30°C',
      normal: 'Normal'
    },
    assetPanel: {
      assets: 'Assets',
      loading: 'Loading assets...',
      uncategorized: 'Uncategorized'
    }
  }
}

const savedLanguage = localStorage.getItem('language') || 'zh'

const i18n = createI18n({
  legacy: false,
  locale: savedLanguage,
  fallbackLocale: 'en',
  messages
})

export default i18n

