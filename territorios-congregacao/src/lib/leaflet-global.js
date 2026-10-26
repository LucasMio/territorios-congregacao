// A ferramenta de desenho (geoman) procura o Leaflet em "window.L".
// Este arquivo precisa ser importado ANTES de '@geoman-io/leaflet-geoman-free'.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

window.L = L;
export default L;
