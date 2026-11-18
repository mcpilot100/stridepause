import { registerRootComponent } from 'expo';

// Define the background location task before anything else loads.
import './src/tracking/locationTask';
import App from './App';

registerRootComponent(App);
