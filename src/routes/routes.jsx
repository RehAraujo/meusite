import { createRoutesFromElements, Route } from 'react-router-dom';
import { SiteLayout } from '../components/layout/SiteLayout';
import AboutPage from '../pages/AboutPage';
import BusinessPage from '../pages/BusinessPage';
import CareerPage from '../pages/CareerPage';
import ContentPage from '../pages/ContentPage';
import HomePage from '../pages/HomePage';
import MediaKitPage from '../pages/MediaKitPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProductPage from '../pages/ProductPage';
import ResumePage from '../pages/ResumePage';
import ServicesPage from '../pages/ServicesPage';
import ThoughtsPage from '../pages/ThoughtsPage';
import ToolsPage from '../pages/ToolsPage';

export const routes = createRoutesFromElements(
  <Route element={<SiteLayout />}>
    <Route index element={<HomePage />} />
    <Route path="sobre" element={<AboutPage />} />
    <Route path="servicos" element={<ServicesPage />} />
    <Route path="negocios" element={<BusinessPage />} />
    <Route path="clientes" element={<ProjectsPage />} />
    <Route path="pensamentos" element={<ThoughtsPage />} />
    <Route path="ferramentas" element={<ToolsPage />} />
    <Route path="carreira" element={<CareerPage />} />
    <Route path="career" element={<CareerPage />} />
    <Route path="curriculo" element={<ResumePage />} />
    <Route path="midia-kit" element={<MediaKitPage />} />
    <Route path="embaixadora" element={<MediaKitPage />} />
    <Route path="guia-alimentar" element={<ProductPage type="guide" />} />
    <Route path="planner-treino" element={<ProductPage type="training" />} />
    {['processo', 'privacidade', 'termos', 'produtos-digitais', 'acessibilidade'].map((path) => (
      <Route key={path} path={path} element={<ContentPage path={`/${path}`} />} />
    ))}
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
);
