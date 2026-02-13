<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="manual-overlay" @click.self="closeManual">
        <div class="manual-container">
          <!-- 头部 -->
          <div class="manual-header">
            <h2>{{ $t('userManual.title') }}</h2>
            <button class="close-btn" @click="closeManual" :title="$t('common.close')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="manual-body">
            <!-- 左侧目录 -->
            <div class="manual-sidebar">
              <div class="sidebar-header">
                <h3>{{ $t('userManual.tableOfContents') }}</h3>
              </div>
              <nav class="manual-nav">
                <div
                  v-for="section in sections"
                  :key="section.id"
                  class="nav-section"
                >
                  <div
                    class="nav-item"
                    :class="{ active: currentSection === section.id }"
                    @click="scrollToSection(section.id)"
                  >
                    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path :d="section.icon" />
                    </svg>
                    <span>{{ section.title }}</span>
                  </div>
                  <!-- 子章节 -->
                  <div v-if="section.subsections && section.subsections.length > 0" class="nav-subsections">
                    <div
                      v-for="subsection in section.subsections"
                      :key="subsection.id"
                      class="nav-subitem"
                      :class="{ active: currentSection === subsection.id }"
                      @click="scrollToSection(subsection.id)"
                    >
                      {{ subsection.title }}
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            <!-- 右侧内容 -->
            <div ref="contentArea" class="manual-content">
              <!-- 系统概述 -->
              <section id="overview" class="content-section">
                <h2>📋 系统概述</h2>
                <p>TwinSight 是一个基于 BIM（建筑信息模型）的数字孪生可视化平台，用于建筑空间和资产的三维展示、数据管理和智能分析。</p>
                
                <h3>核心功能</h3>
                <ul>
                  <li><strong>3D模型查看</strong>：支持上传和浏览 Autodesk Forge 格式的建筑模型</li>
                  <li><strong>空间管理</strong>：查看和编辑建筑空间（房间）的属性信息</li>
                  <li><strong>资产管理</strong>：管理建筑内的各类设备和资产</li>
                  <li><strong>时序数据</strong>：查看温度等环境数据的历史变化</li>
                  <li><strong>智能分析</strong>：集成 AI 进行异常检测和分析</li>
                  <li><strong>全景比对</strong>：支持多个模型版本的对比查看</li>
                </ul>

                <h3>系统架构</h3>
                <p>系统采用前后端分离架构：</p>
                <ul>
                  <li><strong>前端</strong>：Vue 3 + Autodesk Forge Viewer</li>
                  <li><strong>后端</strong>：Node.js + Express</li>
                  <li><strong>数据库</strong>：PostgreSQL（关系数据）+ InfluxDB（时序数据）</li>
                  <li><strong>AI服务</strong>：集成 n8n 工作流和 Gemini API</li>
                </ul>
              </section>

              <!-- 快速入门 -->
              <section id="quickstart" class="content-section">
                <h2>🚀 快速入门</h2>
                
                <h3>登录系统</h3>
                <ol>
                  <li>打开系统主页</li>
                  <li>点击右上角用户图标</li>
                  <li>输入用户名和密码</li>
                  <li>点击"登录"按钮</li>
                </ol>

                <h3>界面布局</h3>
                <div class="info-box">
                  <p><strong>顶部栏</strong>：显示Logo、项目名称、搜索框、视图控制、语言切换和用户菜单</p>
                  <p><strong>左侧栏</strong>：图标导航栏和面板区域（空间、资产、文件管理）</p>
                  <p><strong>中央区域</strong>：3D 模型查看器</p>
                  <p><strong>右侧栏</strong>：属性面板，显示选中对象的详细信息</p>
                  <p><strong>底部栏</strong>：时间轴控制和图表面板</p>
                </div>

                <h3>基本操作</h3>
                <ul>
                  <li><strong>旋转视图</strong>：按住鼠标左键拖动</li>
                  <li><strong>平移视图</strong>：按住鼠标中键（滚轮）拖动</li>
                  <li><strong>缩放视图</strong>：滚动鼠标滚轮</li>
                  <li><strong>选择对象</strong>：单击对象</li>
                  <li><strong>聚焦对象</strong>：双击对象</li>
                </ul>
              </section>

              <!-- 模型管理 -->
              <section id="model-management" class="content-section">
                <h2>📦 模型管理</h2>
                
                <h3>上传模型</h3>
                <ol>
                  <li>点击左侧图标栏的"文件"图标（第三个）</li>
                  <li>在文件管理面板中，点击"上传文件"按钮</li>
                  <li>选择本地的模型文件（支持 .rvt, .nwd, .dwg 等格式）</li>
                  <li>填写模型标题和描述</li>
                  <li>等待上传和处理完成</li>
                </ol>
                
                <div class="warning-box">
                  <strong>⚠️ 注意</strong>：模型文件需要先通过 Autodesk Forge 转换服务处理，首次上传可能需要几分钟时间。
                </div>

                <h3>激活模型</h3>
                <ol>
                  <li>在文件列表中找到要激活的模型</li>
                  <li>点击模型卡片上的"激活"按钮</li>
                  <li>系统会自动加载该模型到 3D 查看器</li>
                  <li>同时加载该模型相关的空间和资产数据</li>
                </ol>

                <h3>删除模型</h3>
                <ol>
                  <li>点击模型卡片上的"删除"按钮</li>
                  <li>在确认对话框中选择是否同时删除关联的知识库数据</li>
                  <li>点击"确认删除"</li>
                </ol>

                <h3>全景比对</h3>
                <p>全景比对功能允许您并排查看两个不同版本的模型：</p>
                <ol>
                  <li>在文件列表中找到要比对的模型</li>
                  <li>点击模型卡片上的"全景比对"按钮</li>
                  <li>系统会在新页面中打开当前激活模型和选中模型的对比视图</li>
                  <li>两个视图的相机操作会自动同步</li>
                </ol>
              </section>

              <!-- 空间与资产 -->
              <section id="spaces-assets" class="content-section">
                <h2>🏢 空间与资产</h2>
                
                <h3>浏览空间</h3>
                <ol>
                  <li>点击左侧图标栏的"空间"图标（第一个）</li>
                  <li>在空间列表中浏览所有房间</li>
                  <li>使用顶部的筛选和排序功能</li>
                  <li>点击空间名称在 3D 视图中高亮显示</li>
                </ol>

                <h3>浏览资产</h3>
                <ol>
                  <li>点击左侧图标栏的"资产"图标（第二个）</li>
                  <li>在资产列表中浏览所有设备</li>
                  <li>可按分类、楼层、房间等条件筛选</li>
                  <li>点击资产名称在 3D 视图中高亮显示</li>
                </ol>

                <h3>查看和编辑属性</h3>
                <ol>
                  <li>在列表中选择空间或资产（可多选）</li>
                  <li>点击"查看详情"按钮打开右侧属性面板</li>
                  <li>查看对象的所有属性信息</li>
                  <li>对于可编辑字段，直接修改后会自动保存</li>
                  <li>支持批量编辑多个对象的相同属性</li>
                </ol>

                <h3>数据导出</h3>
                <ol>
                  <li>点击顶部栏的"导出"按钮</li>
                  <li>选择要导出的数据类型（空间或资产）</li>
                  <li>选择导出格式（CSV 或 IFC）</li>
                  <li>配置字段映射（如需要）</li>
                  <li>点击"导出"下载文件</li>
                </ol>
              </section>

              <!-- 3D视图操作 -->
              <section id="3d-operations" class="content-section">
                <h2>🎮 3D视图操作</h2>
                
                <h3>视图控制</h3>
                <table class="operation-table">
                  <thead>
                    <tr>
                      <th>操作</th>
                      <th>方法</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>旋转</td>
                      <td>鼠标左键拖动</td>
                      <td>围绕中心点旋转视图</td>
                    </tr>
                    <tr>
                      <td>平移</td>
                      <td>鼠标中键拖动</td>
                      <td>上下左右移动视图</td>
                    </tr>
                    <tr>
                      <td>缩放</td>
                      <td>滚轮滚动</td>
                      <td>放大或缩小视图</td>
                    </tr>
                    <tr>
                      <td>选择</td>
                      <td>单击对象</td>
                      <td>高亮选中的对象</td>
                    </tr>
                    <tr>
                      <td>聚焦</td>
                      <td>双击对象</td>
                      <td>相机移动到对象位置</td>
                    </tr>
                    <tr>
                      <td>复位</td>
                      <td>点击主页图标</td>
                      <td>恢复到默认视图</td>
                    </tr>
                  </tbody>
                </table>

                <h3>保存视图</h3>
                <ol>
                  <li>调整相机到理想位置</li>
                  <li>点击顶部栏的"视图"按钮（四个方格图标）</li>
                  <li>在视图面板中点击"保存当前视图"</li>
                  <li>输入视图名称和描述</li>
                  <li>可选择是否设为默认视图</li>
                  <li>点击"保存"</li>
                </ol>

                <h3>恢复视图</h3>
                <ol>
                  <li>点击顶部栏的"视图"按钮</li>
                  <li>在已保存的视图列表中选择一个视图</li>
                  <li>点击"加载"按钮</li>
                  <li>相机会自动切换到保存时的位置</li>
                </ol>

                <h3>截图功能</h3>
                <p>保存视图时会自动创建截图缩略图，您也可以：</p>
                <ul>
                  <li>使用浏览器的截图功能</li>
                  <li>按 <code>Ctrl + P</code> 打印当前视图</li>
                </ul>
              </section>

              <!-- 数据可视化 -->
              <section id="data-visualization" class="content-section">
                <h2>📊 数据可视化</h2>
                
                <h3>时间轴控制</h3>
                <p>时间轴位于 3D 视图下方，用于查看历史数据：</p>
                <ol>
                  <li>拖动时间滑块查看不同时刻的数据</li>
                  <li>点击"播放"按钮自动播放时序数据</li>
                  <li>调整播放速度（1x, 2x, 5x）</li>
                  <li>选择日期范围缩小查看窗口</li>
                </ol>

                <h3>温度热力图</h3>
                <ol>
                  <li>确保已加载包含温度传感器的模型</li>
                  <li>时间轴会按时间展示各房间的温度数据</li>
                  <li>3D 模型中的房间会根据温度显示不同颜色</li>
                  <li>悬停在房间上可查看实时温度值</li>
                </ol>
                
                <div class="info-box">
                  <strong>💡 提示</strong>：颜色映射规则 - 蓝色（低温）→ 绿色（正常）→ 黄色（偏高）→ 红色（高温）
                </div>

                <h3>图表面板</h3>
                <ol>
                  <li>点击左侧图标栏的"图表"图标</li>
                  <li>选择一个或多个房间</li>
                  <li>底部会显示温度曲线图</li>
                  <li>单个房间显示详细图表</li>
                  <li>多个房间显示对比图表</li>
                  <li>鼠标悬停查看具体数值</li>
                  <li>图表与时间轴同步</li>
                </ol>
              </section>

              <!-- AI 智能助手 -->
              <section id="ai-assistant" class="content-section">
                <h2>🤖 AI 智能助手</h2>

                <h3>功能概述</h3>
                <p>TwinSight AI 助手是一个智能对话面板，可以帮您快速查询资产、空间信息，分析异常数据，并提供运维建议。</p>

                <h3>打开 AI 助手</h3>
                <ol>
                  <li>点击屏幕右下角的蓝色机器人图标（浮动按钮）</li>
                  <li>AI 面板会展开，显示欢迎界面和快捷建议</li>
                  <li>您可以拖动面板顶部来移动位置</li>
                  <li>拖动面板右下角可以调整大小</li>
                </ol>

                <h3>对话功能</h3>
                <ul>
                  <li><strong>自然语言查询</strong>：直接输入问题，如"这个房间有什么设备？"</li>
                  <li><strong>上下文对话</strong>：系统会记住当前选中的空间或资产，自动关联对话</li>
                  <li><strong>快捷建议</strong>：点击预设问题快速获取信息</li>
                  <li><strong>历史记录</strong>：对话内容会在面板中保留，便于回顾</li>
                </ul>

                <div class="info-box">
                  <strong>💡 提示</strong>：支持 Enter 发送消息，Shift+Enter 换行
                </div>

                <h3>智能分析</h3>
                <p>当系统检测到异常数据时，AI 会主动触发分析：</p>
                <ul>
                  <li><strong>温度异常</strong>：超过阈值时自动分析原因</li>
                  <li><strong>设备故障</strong>：结合知识库提供维修建议</li>
                  <li><strong>参考来源</strong>：分析结果会引用相关文档</li>
                  <li><strong>可操作建议</strong>：提供具体的处理步骤</li>
                </ul>

                <h3>图表查看</h3>
                <p>AI 可以在对话中直接显示数据图表：</p>
                <ol>
                  <li>询问"显示最近一周的温度趋势"</li>
                  <li>AI 会生成图表嵌入在对话中</li>
                  <li>点击"放大查看"按钮打开独立图表窗口</li>
                  <li>图表窗口也可以拖动和调整大小</li>
                </ol>

                <h3>文档参考</h3>
                <p>AI 回答中引用的文档可以直接点击查看：</p>
                <ul>
                  <li>点击引用标记 [1]、[2] 等</li>
                  <li>内部文档会在预览面板中打开</li>
                  <li>外部链接会在新标签页打开</li>
                </ol>

                <h3>快捷操作</h3>
                <table class="operation-table">
                  <thead>
                    <tr>
                      <th>问题示例</th>
                      <th>功能说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>"这个房间有什么告警吗？"</td>
                      <td>查询选中房间的告警信息</td>
                    </tr>
                    <tr>
                      <td>"显示最近一周的温度趋势"</td>
                      <td>生成温度变化图表</td>
                    </tr>
                    <tr>
                      <td>"高亮所有供电设备"</td>
                      <td>在 3D 视图中高亮显示</td>
                    </tr>
                    <tr>
                      <td>"查找空调的维修手册"</td>
                      <td>搜索相关文档资料</td>
                    </tr>
                  </tbody>
                </table>

                <h3>清空对话</h3>
                <p>点击面板头部的清空图标（垃圾桶）可以清除当前对话历史，开始新的会话。</p>
              </section>

              <!-- 高级功能 -->
              <section id="advanced-features" class="content-section">
                <h2>⚙️ 高级功能</h2>
                
                <h3>数据导出映射</h3>
                <p>导出数据时可以自定义字段映射：</p>
                <ol>
                  <li>在导出面板中选择"自定义映射"</li>
                  <li>为每个目标字段选择源属性</li>
                  <li>支持常量值和表达式</li>
                  <li>保存映射配置供下次使用</li>
                </ol>

                <h3>用户设置</h3>
                <ol>
                  <li>点击右上角用户头像打开菜单</li>
                  <li>选择"个人设置"</li>
                  <li>可以修改：
                    <ul>
                      <li>用户名和邮箱</li>
                      <li>头像（上传图片）</li>
                      <li>密码</li>
                      <li>界面语言</li>
                      <li>主题偏好</li>
                    </ul>
                  </li>
                </ol>

                <h3>主题切换</h3>
                <p>系统支持多种主题模式：</p>
                <ul>
                  <li><strong>深色模式</strong>：默认主题，适合长时间使用</li>
                  <li><strong>浅色模式</strong>：明亮界面</li>
                  <li><strong>高对比度</strong>：增强可访问性</li>
                </ul>
                <p>切换方法：点击右上角用户菜单 → 主题设置</p>

                <h3>快捷键</h3>
                <table class="operation-table">
                  <thead>
                    <tr>
                      <th>快捷键</th>
                      <th>功能</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>F</code></td>
                      <td>聚焦到选中对象</td>
                    </tr>
                    <tr>
                      <td><code>H</code></td>
                      <td>回到默认视图</td>
                    </tr>
                    <tr>
                      <td><code>Esc</code></td>
                      <td>取消选择/关闭面板</td>
                    </tr>
                    <tr>
                      <td><code>Ctrl + F</code></td>
                      <td>搜索</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- 常见问题 -->
              <section id="faq" class="content-section">
                <h2>❓ 常见问题</h2>
                
                <h3>模型加载失败</h3>
                <div class="faq-item">
                  <p><strong>问题</strong>：上传模型后无法显示</p>
                  <p><strong>原因</strong>：</p>
                  <ul>
                    <li>模型文件格式不支持</li>
                    <li>Forge 转换服务未完成</li>
                    <li>网络连接问题</li>
                  </ul>
                  <p><strong>解决方法</strong>：</p>
                  <ol>
                    <li>检查文件格式是否为支持的类型</li>
                    <li>等待转换完成（可能需要几分钟）</li>
                    <li>刷新页面重试</li>
                    <li>查看浏览器控制台的错误信息</li>
                  </ol>
                </div>

                <h3>数据不显示</h3>
                <div class="faq-item">
                  <p><strong>问题</strong>：切换模型后资产或空间列表为空</p>
                  <p><strong>原因</strong>：</p>
                  <ul>
                    <li>该模型尚未导入数据</li>
                    <li>数据库连接失败</li>
                  </ul>
                  <p><strong>解决方法</strong>：</p>
                  <ol>
                    <li>使用数据导出功能导入初始数据</li>
                    <li>检查后端 API 服务状态</li>
                    <li>联系管理员检查数据库</li>
                  </ol>
                </div>

                <h3>性能优化建议</h3>
                <div class="faq-item">
                  <p><strong>问题</strong>：3D 视图操作卡顿</p>
                  <p><strong>解决方法</strong>：</p>
                  <ul>
                    <li>关闭不必要的浏览器标签页</li>
                    <li>降低浏览器缩放比例</li>
                    <li>更新显卡驱动</li>
                    <li>使用 Chrome 或 Edge 浏览器</li>
                    <li>对于大型模型，隐藏部分构件</li>
                  </ul>
                </div>

                <h3>温度数据异常</h3>
                <div class="faq-item">
                  <p><strong>问题</strong>：温度显示为负值或不合理</p>
                  <p><strong>原因</strong>：</p>
                  <ul>
                    <li>传感器故障</li>
                    <li>数据导入错误</li>
                  </ul>
                  <p><strong>解决方法</strong>：</p>
                  <ol>
                    <li>检查 InfluxDB 中的原始数据</li>
                    <li>验证数据导入脚本</li>
                    <li>联系硬件维护人员检查传感器</li>
                  </ol>
                </div>

                <h3>需要帮助？</h3>
                <div class="info-box">
                  <p>如果遇到其他问题，请联系技术支持：</p>
                  <ul>
                    <li>📧 邮箱：support@twinsight.com</li>
                    <li>📞 电话：400-xxx-xxxx</li>
                    <li>💬 在线客服：工作日 9:00-18:00</li>
                  </ul>
                </div>
              </section>

              <!-- 系统信息 -->
              <section id="system-info" class="content-section">
                <h2>ℹ️ 系统信息</h2>
                <p><strong>版本</strong>：TwinSight v1.0.0</p>
                <p><strong>最后更新</strong>：2026-01-06</p>
                <p><strong>技术栈</strong>：Vue 3 + Node.js + PostgreSQL + InfluxDB</p>
                <p><strong>浏览器要求</strong>：Chrome 90+, Edge 90+, Firefox 88+, Safari 14+</p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const contentArea = ref(null);
const currentSection = ref('overview');

// 章节定义
const sections = ref([
  {
    id: 'overview',
    title: '系统概述',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
  },
  {
    id: 'quickstart',
    title: '快速入门',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
  },
  {
    id: 'model-management',
    title: '模型管理',
    icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'
  },
  {
    id: 'spaces-assets',
    title: '空间与资产',
    icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
  },
  {
    id: '3d-operations',
    title: '3D视图操作',
    icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'
  },
  {
    id: 'data-visualization',
    title: '数据可视化',
    icon: 'M18 20V10 M12 20V4 M6 20v-6'
  },
  {
    id: 'ai-assistant',
    title: 'AI 智能助手',
    icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5'
  },
  {
    id: 'advanced-features',
    title: '高级功能',
    icon: 'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'
  },
  {
    id: 'faq',
    title: '常见问题',
    icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01'
  },
  {
    id: 'system-info',
    title: '系统信息',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }
]);

// 关闭面板
const closeManual = () => {
  emit('close');
};

// 滚动到指定章节
const scrollToSection = (sectionId) => {
  currentSection.value = sectionId;
  const element = document.getElementById(sectionId);
  if (element && contentArea.value) {
    contentArea.value.scrollTo({
      top: element.offsetTop - 20,
      behavior: 'smooth'
    });
  }
};

// 监听滚动，更新当前章节
const handleScroll = () => {
  if (!contentArea.value) return;
  
  const scrollTop = contentArea.value.scrollTop;
  const sectionElements = sections.value.map(s => ({
    id: s.id,
    element: document.getElementById(s.id)
  })).filter(s => s.element);

  for (let i = sectionElements.length - 1; i >= 0; i--) {
    const section = sectionElements[i];
    if (section.element.offsetTop - 100 <= scrollTop) {
      currentSection.value = section.id;
      break;
    }
  }
};

// 按 ESC 键关闭
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.visible) {
    closeManual();
  }
};

watch(() => props.visible, (newVal) => {
  if (newVal) {
    document.addEventListener('keydown', handleKeydown);
    // 打开时滚动到顶部
    if (contentArea.value) {
      contentArea.value.scrollTop = 0;
      currentSection.value = 'overview';
    }
  } else {
    document.removeEventListener('keydown', handleKeydown);
  }
});

onMounted(() => {
  if (contentArea.value) {
    contentArea.value.addEventListener('scroll', handleScroll);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (contentArea.value) {
    contentArea.value.removeEventListener('scroll', handleScroll);
  }
});
</script>

<style scoped>
/* 遮罩层 */
.manual-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

/* 容器 */
.manual-container {
  background: var(--vscode-editor-background, #1e1e1e);
  border-radius: 8px;
  width: 100%;
  max-width: 1200px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* 头部 */
.manual-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--vscode-panel-border, #2b2b2b);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.manual-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--vscode-editor-foreground, #cccccc);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--vscode-icon-foreground, #cccccc);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, #2a2d2e);
  color: var(--vscode-foreground, #ffffff);
}

/* 主体 */
.manual-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 侧边栏 */
.manual-sidebar {
  width: 260px;
  background: var(--vscode-sideBar-background, #252526);
  border-right: 1px solid var(--vscode-panel-border, #2b2b2b);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--vscode-panel-border, #2b2b2b);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground, #cccccc);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.manual-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.nav-section {
  margin-bottom: 2px;
}

.nav-item {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--vscode-foreground, #cccccc);
  font-size: 13px;
  transition: all 0.2s;
  user-select: none;
}

.nav-item:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.nav-item.active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
  color: var(--vscode-list-activeSelectionForeground, #ffffff);
}

.nav-icon {
  flex-shrink: 0;
}

.nav-subsections {
  margin-left: 26px;
}

.nav-subitem {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--vscode-foreground, #999999);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.nav-subitem:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
  color: var(--vscode-foreground, #cccccc);
}

.nav-subitem.active {
  color: var(--vscode-textLink-foreground, #3794ff);
  font-weight: 500;
}

/* 内容区域 */
.manual-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
  color: var(--vscode-editor-foreground, #cccccc);
  line-height: 1.6;
}

.content-section {
  margin-bottom: 48px;
  scroll-margin-top: 20px;
}

.content-section h2 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--vscode-editor-foreground, #ffffff);
  border-bottom: 2px solid var(--vscode-textLink-foreground, #3794ff);
  padding-bottom: 8px;
}

.content-section h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 12px 0;
  color: var(--vscode-editor-foreground, #eeeeee);
}

.content-section p {
  margin: 12px 0;
  font-size: 14px;
}

.content-section ul,
.content-section ol {
  margin: 12px 0;
  padding-left: 24px;
}

.content-section li {
  margin: 8px 0;
  font-size: 14px;
}

.content-section code {
  background: var(--vscode-textCodeBlock-background, #1e1e1e);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: var(--vscode-textPreformat-foreground, #d7ba7d);
}

/* 信息框 */
.info-box {
  background: rgba(58, 150, 221, 0.1);
  border-left: 4px solid #3a96dd;
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
}

.info-box p {
  margin: 8px 0;
}

.info-box strong {
  color: #3a96dd;
}

/* 警告框 */
.warning-box {
  background: rgba(255, 191, 0, 0.1);
  border-left: 4px solid #ffbf00;
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
}

.warning-box strong {
  color: #ffbf00;
}

/* FAQ 项 */
.faq-item {
  background: var(--vscode-editor-inactiveSelectionBackground, #37373d);
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
  border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
}

.faq-item p:first-child {
  margin-top: 0;
}

.faq-item p:last-child {
  margin-bottom: 0;
}

/* 表格 */
.operation-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
}

.operation-table th,
.operation-table td {
  padding: 12px;
  text-align: left;
  border: 1px solid var(--vscode-panel-border, #2b2b2b);
}

.operation-table th {
  background: var(--vscode-editor-inactiveSelectionBackground, #37373d);
  font-weight: 600;
  color: var(--vscode-editor-foreground, #ffffff);
}

.operation-table tr:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

/* 滚动条样式 */
.manual-nav::-webkit-scrollbar,
.manual-content::-webkit-scrollbar {
  width: 10px;
}

.manual-nav::-webkit-scrollbar-track,
.manual-content::-webkit-scrollbar-track {
  background: transparent;
}

.manual-nav::-webkit-scrollbar-thumb,
.manual-content::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background, #424242);
  border-radius: 5px;
}

.manual-nav::-webkit-scrollbar-thumb:hover,
.manual-content::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-scrollbarSlider-hoverBackground, #4e4e4e);
}

/* 动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .manual-container,
.modal-fade-leave-active .manual-container {
  transition: transform 0.3s ease;
}

.modal-fade-enter-from .manual-container,
.modal-fade-leave-to .manual-container {
  transform: scale(0.95);
}

/* 响应式 */
@media (max-width: 768px) {
  .manual-sidebar {
    width: 200px;
  }
  
  .manual-content {
    padding: 20px;
  }
  
  .content-section h2 {
    font-size: 24px;
  }
  
  .content-section h3 {
    font-size: 18px;
  }
}
</style>
