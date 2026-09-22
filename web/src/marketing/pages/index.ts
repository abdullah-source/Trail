/* Marketing pages. Each is a default-exported page body (no Nav/Footer);
   mount them inside <MarketingLayout/> (Nav + <main id="main"> + Footer). */
export { default as Home } from './Home';
export { default as HowItWorks } from './HowItWorks';
export { default as Pricing } from './Pricing';
export { default as Privacy } from './Privacy';
export { default as Terms } from './Terms';

export { Nav, Footer, MarketingLayout, CHROME_STORE_URL } from '../../design/components';
