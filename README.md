# GreenCart — HTML, CSS and JavaScript only

This is the static, no-framework conversion of GreenCart. The original visual interface and workflows are retained; the Express server/API has been replaced with a browser `localStorage` data layer.

## Run

Open `public/index.html` in a browser, or publish the `public` folder to a static host such as GitHub Pages or Vercel. No `npm install`, build step, server, framework, or database is required.

## Demo admin login

- Email: `admin@greencart.com`
- Password: `admin123`

Customers can register from the Log in page.

## Features

- Search and category-filter grocery products
- Stock indicators and add-to-cart
- Cart quantity changes, delivery fee calculation, address and phone validation
- Cash-on-delivery order placement and customer order history/status tracking
- Admin product creation/removal, stock editing, and order status updates
- Cancelled orders return stock
- Local persistence for cart, account data, products, and orders

## Important limitation

Because this version has no backend, account credentials and order/catalog data are stored in the current browser's localStorage. This is suitable for a demo/prototype, not production authentication or multi-user shared inventory. Different browsers/devices do not share data, and localStorage is not secure storage. The original server's bcrypt/JWT protections and server-side enforcement cannot exist in a frontend-only application.

To reset demo data, clear this site's localStorage (keys beginning with `gc_`) in browser developer tools.
