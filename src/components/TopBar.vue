<template>
  <div class="top-bar">
    <div class="left-section">
      <!-- Logo 区域 -->
      <div class="logo-container">
        <!-- 注意：这里使用了相对路径 ../assets/logo.png -->
        <img src="../assets/logo.png" alt="Logo" class="logo" />
      </div>
      <div class="app-info">
        <div class="divider"></div>
        <span class="app-name">乐龄汇</span>
      </div>
    </div>

    <div class="center-section">
      <div class="search-box">
        <!-- Search Icon -->
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="Search 乐龄汇" />
      </div>
    </div>

    <div class="right-section">
      <div class="nav-text">Save view</div>
      
      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </div>
      
      <div class="icon-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>

      <div class="user-avatar">韦翟</div>
    </div>
  </div>
</template>

<style scoped>
.top-bar {
  height: 48px;
  background-color: #2b2b2b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #111;
  color: #ccc;
  flex-shrink: 0;
  user-select: none;
}

.left-section, .center-section, .right-section {
  display: flex;
  align-items: center;
}

.logo {
  height: 24px;
  width: auto;
  display: block;
}

.app-info {
  display: flex;
  align-items: center;
}

.divider {
  width: 1px;
  height: 16px;
  background: #555;
  margin: 0 12px;
}

.app-name {
  font-size: 14px;
  color: #ddd;
  font-weight: 500;
}

.search-box {
  background: #1f1f1f;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  height: 28px;
  display: flex;
  align-items: center;
  width: 400px;
  padding: 0 8px;
}

.search-box:hover {
  border-color: #666;
}

.search-icon {
  color: #888;
  margin-right: 8px;
  flex-shrink: 0;
}

.search-box input {
  background: transparent;
  border: none;
  color: #fff;
  width: 100%;
  outline: none;
  font-size: 12px;
}

.nav-text {
  font-size: 12px;
  margin-right: 16px;
  cursor: pointer;
}

.nav-text:hover {
  color: #fff;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ccc;
}

.icon-btn:hover {
  background: #3e3e42;
  border-radius: 2px;
}

.user-avatar {
  background: #99c7fb;
  color: #000;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  margin-left: 10px;
  flex-shrink: 0;
}
</style>