import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
export default [{ignores:['dist/**','src/pages/QuanLyVe/**','src/pages/LichSuRaVao/**','src/pages/BienBanViPham/**','src/hooks/useVeThang.js']},{files:['src/**/*.{js,jsx}'],languageOptions:{ecmaVersion:'latest',sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}},globals:globals.browser},plugins:{'react-hooks':reactHooks},rules:{...js.configs.recommended.rules,...reactHooks.configs.flat.recommended.rules,'react-hooks/set-state-in-effect':'off','no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},{files:['src/pages/Pricing/index.jsx','src/pages/Tickets/index.jsx'],rules:{'no-unused-vars':'off'}}];
