import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(<ErrorBoundary fallbackTitle="Não foi possível abrir a Central"><App /></ErrorBoundary>);
