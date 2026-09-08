My personal portfolio website, built with [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/) and deployed to [Vercel](https://vercel.com/). Based on [chronark's site](https://chronark.com/). Some ideas borrowed from [leerob/leerob.io](https://github.com/leerob/leerob.io).

It is supposed to be used as a **template for other GitHub users' portfolios**. Data about user and projects are gathered via GitHub and Vercel API.

## Tech stack

- **Framework**: [Next.js](https://nextjs.org/) 16.3.3
- **Deployment**: [Vercel](https://vercel.com)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) 4.3.1
- **UI**: [React](https://react.dev/) 19.2.8
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/) 5.7.0
- **Node.js**: 24.x

## Project Information Features

The portfolio automatically displays comprehensive information for each repository in the `/projects` page. Here's what visitors can expect to see for each project:

### Repository Details

- **Project name** with gradient styling and clickable links
- **Description** from GitHub repository
- **Creation date** showing when the project was started
- **Star count** with compact number formatting
- **GitHub repository link** for easy access to source code

### Repository Analytics (for your own repositories)

- **Visitor statistics**: Unique repository visitors in the last 14 days and today
- **Security alerts**: Dependabot alerts categorized by severity (critical, high, medium, low)
- **AI agent contributions**: Counts of merged GitHub Copilot pull requests and Codex contributions, including labeled PRs and co-authored commits

### Deployment & Technology Detection

- **Vercel integration**: Shows deployment status, Node.js version, and framework info
- **Framework detection**:
  - Next.js projects with Pages Router, App Router, or hybrid detection
  - Turbopack usage indicator
  - Next.js version upgrade recommendations
- **UI library detection**: Automatically identifies Tailwind CSS, React Bootstrap, Primer, and other libraries from package.json

### Data Sources

- **GitHub API**: Repository information, traffic data, security alerts, pull requests, and AI agent contribution signals
- **Vercel API**: Deployment information and project details
- **GraphQL queries**: Pinned repositories, organization data, Copilot-authored merged pull requests, Codex-labeled merged pull requests, and Codex co-authored commits

All data is cached and refreshed automatically to ensure good performance while providing up-to-date information.
