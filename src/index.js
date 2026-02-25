export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);

            //Serve the main HTML page
            if (url.pathname === "/") {
                return serveHtmlPage();
            }

            //API Endpoint: Get all projects from KV
            if (url.pathname === "/api/projects") {
                return handleGetProjectsKV(env);
            }

            //Serve images from R2
            if (url.pathname.startsWith("/images/")) {
                const imageKey = url.pathname.replace("/images/", "");
                return handleGetImageR2(imageKey, env);
            }

            //Fallback for 404 Not Found
            return new Response("Not Found", { status: 404 });
        } catch (error) {
            console.error("Worker error:", error);
            return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }
    }
};

function serveHtmlPage() {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Portfolio</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            <div id="projects" class="projects">Loading...</div>

            <script>
                async function loadProjects() {
                    const response = await fetch('/api/projects');
                    const projects = await response.json();
                    const projectsContainer = document.getElementById('projects');

                    if (projects.length === 0) {
                        projectsContainer.innerHTML = '<p>No projects found.</p>';
                        return;
                    }

                    projectsContainer.innerHTML = projects.map(project => \`
                        <div class="project">
                            ${project.imageKey ? `<img src="/images/${project.imageKey}" alt="${project.name}">` : ''}

                            ${project.tags ? `<div class="tags">${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
                            <h2>${project.name}</h2>
                            <p>\${project.description}</p>
                            \${project.image ? \`<img src="/images/${project.image}" alt="${project.name}">\` : ''}
                        </div>
                    \`).join('');
                }

                loadProjects();
            </script>
        </body>
        </html>
    `;

    return new Response(htmlContent, {
        headers: { "Content-Type": "text/html" }
    });
}

//Get all projects from KV and return as JSON
async function handleGetProjectsKV(env) {
    try {
        const list = await env["wds-portfolio-test_KV"].list({ prefix: 'project:' });
        const projects = [];

        for (const key of list.keys) {
            const value = await env["wds-portfolio-test_KV"].get(key.name);
            if (value) {
                projects.push(JSON.parse(value));
            }
        }

        //Sort by newest first
        projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return new Response(JSON.stringify(projects), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response("Error fetching projects", { status: 500 });
    }
}

//Serve images from R2 
async function handleGetImageR2(imageKey, env) {
    try {
        const object = await env["wds-portfolio-test_R2"].get(imageKey);
        if (!object) {
            return new Response("Image not found", { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("cache-control", "public, max-age=31536000");

        return new Response(object.body, {
            headers
        });
    } catch (error) {
        return new Response("Error fetching image", { status: 500 });
    }
}