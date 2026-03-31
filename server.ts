import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import firebaseConfig from "./firebase-applet-config.json";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
    const app = express();
    const PORT = 3000;

    // Security Headers
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    imgSrc: ["'self'", "data:", "https://picsum.photos", "https://firebasestorage.googleapis.com", "https://*.run.app"],
                    connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "https://api.mercadolibre.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    objectSrc: ["'none'"],
                    upgradeInsecureRequests: [],
                },
            },
            crossOriginEmbedderPolicy: false,
        })
    );

    let vite: any;
    if (process.env.NODE_ENV !== "production") {
        vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.resolve(__dirname, "dist")));
    }

    // SSR Route for Products
    app.get("/produto/:id", async (req, res) => {
        const productId = req.params.id;
        try {
            const docRef = doc(db, "produtos", productId);
            const docSnap = await getDoc(docRef);

            let title = "BARATELAS - Telas Baratas Para Você";
            let description = "Sua central definitiva de tecnologia. Analisamos as melhores ofertas para garantir sua melhor escolha.";
            let image = "https://ais-dev-nv3dnee36frwggum5zuoey-47496851777.us-east1.run.app/public/og-image.png";

            let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
            
            if (vite) {
                template = await vite.transformIndexHtml(req.originalUrl, template);
            }

            if (docSnap.exists()) {
                const p = docSnap.data();
                title = `${p.title} - BARATELAS`;
                description = `Confira ${p.title} por apenas R$ ${p.price?.toLocaleString('pt-BR')} na ${p.store}. Tech Score: ${Number(p.techScore ?? p.score ?? 0).toFixed(1)}/10.`;
                image = p.imageUrl || image;

                // JSON-LD for Product Offer
                const jsonLd = {
                    "@context": "https://schema.org/",
                    "@type": "Product",
                    "name": p.title,
                    "image": [p.imageUrl],
                    "description": p.description || description,
                    "brand": {
                        "@type": "Brand",
                        "name": p.brand || "BARATELAS"
                    },
                    "offers": {
                        "@type": "Offer",
                        "url": `https://${req.get('host')}${req.originalUrl}`,
                        "priceCurrency": "BRL",
                        "price": p.price,
                        "itemCondition": "https://schema.org/NewCondition",
                        "availability": "https://schema.org/InStock",
                        "seller": {
                            "@type": "Organization",
                            "name": p.store
                        }
                    }
                };

                const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
                template = template.replace('</head>', `${jsonLdScript}</head>`);
            }

            const html = template
                .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
                .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${description}">`)
                .replace(/<meta property="og:title" content=".*?">/g, `<meta property="og:title" content="${title}">`)
                .replace(/<meta property="og:description" content=".*?">/g, `<meta property="og:description" content="${description}">`)
                .replace(/<meta property="og:image" content=".*?">/g, `<meta property="og:image" content="${image}">`)
                .replace(/<meta property="og:url" content=".*?">/g, `<meta property="og:url" content="https://${req.get('host')}${req.originalUrl}">`)
                .replace(/<meta name="twitter:title" content=".*?">/g, `<meta name="twitter:title" content="${title}">`)
                .replace(/<meta name="twitter:description" content=".*?">/g, `<meta name="twitter:description" content="${description}">`)
                .replace(/<meta name="twitter:image" content=".*?">/g, `<meta name="twitter:image" content="${image}">`);

            res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } catch (e) {
            // Silently handle error
            res.status(500).end("Internal Server Error");
        }
    });

    // Catch-all for other routes
    app.get("*", async (req, res) => {
        try {
            let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
            if (vite) {
                template = await vite.transformIndexHtml(req.originalUrl, template);
            }
            res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
            // Silently handle error
            res.status(500).end("Internal Server Error");
        }
    });

    app.listen(PORT, "0.0.0.0", () => {
        // Server started
    });
}

startServer();
