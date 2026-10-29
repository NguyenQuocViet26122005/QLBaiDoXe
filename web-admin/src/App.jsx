import { FluentProvider, createLightTheme } from '@fluentui/react-components';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppRoutes from './routes/AppRoutes';

const parkTheme = createLightTheme({ 10:'#240900',20:'#421200',30:'#641c03',40:'#842708',50:'#a5340e',60:'#c44214',70:'#e04d1d',80:'#f05a28',90:'#f67648',100:'#fa926b',110:'#fcad8f',120:'#fdc7b3',130:'#fee0d4',140:'#fff0ea',150:'#fff8f5',160:'#ffffff' });

export default function App() {
  return <FluentProvider theme={parkTheme}><BrowserRouter><AuthProvider><ToastProvider><AppRoutes /></ToastProvider></AuthProvider></BrowserRouter></FluentProvider>;
}
