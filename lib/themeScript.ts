// Theme 進場 script 的唯一來源。
// layout.tsx 於 <head> inline 注入，useTheme 的執行期邏輯必須與此行為一致：
// 只切換 .dark-mode class 與 colorScheme，背景一律交給 CSS token（html background），
// 避免任何 inline style 蓋過主題變數。
export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=window.matchMedia('(prefers-color-scheme:dark)').matches;var dark=t==='dark'||(t==='system'&&d);var root=document.documentElement;if(dark){root.classList.add('dark-mode');root.style.colorScheme='dark';}else{root.classList.remove('dark-mode');root.style.colorScheme='light';}}catch(e){}})();`;