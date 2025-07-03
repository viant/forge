# Forge

Forge is an open-source framework for building modern web applications.  
It features a **React-based frontend** and a **Go backend**, offering flexibility and scalability for dynamic, interactive applications.
Forge has been **built with LLMs**, leveraging AI-powered capabilities to enhance development and functionality.


## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
    - [Prerequisites](#prerequisites)
    - [Frontend Setup](#frontend-setup)
    - [Backend Setup](#backend-setup)
- [Usage](#usage)
    - [Running the Application](#running-the-application)
    - [Available Components](#available-components)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
# Documentation
- [Parameter passing between windows](docs/window-parameter-passing.md)
- [Schema-driven forms](docs/jsonschema-forms.md)
- [Widgets reference](docs/widgets.md)

## Introduction

Forge aims to simplify the development of web applications by providing a structured approach that integrates both frontend and backend development. With reusable components and services, developers can focus on building features rather than setting up configurations.

## Features

- **Modular React Components**: Reusable components such as `LayoutRenderer`, `Container`, `FileBrowser`, and `Editor` for building dynamic user interfaces.
- **State Management with Signals**: Utilizes `@preact/signals-react` for efficient state management and reactivity.
- **Window and Dialog Management**: Handle multiple windows and dialogs within the application using `WindowManager` and `ViewDialog`.
- **Data Handling and Services**: Backend services in Go for handling data operations, including file browsing, navigation, and metadata loading.
- **Dynamic Form and Table Rendering**: Render forms and tables dynamically based on configurations.
- **Chart Integration**: Supports data visualization with chart components.
- **File System Integration**: Access and manipulate files using the backend file service.

## Architecture

Forge is divided into two main parts:

- **Frontend**: Built with React and utilizes modern JavaScript features along with libraries like Blueprint.js for UI components.
- **Backend**: Built with Go (Golang), providing APIs and services to the frontend. It uses the `viant/afs` library for abstract file system interactions.

## Installation

### Prerequisites

- **Node.js** (version 14.x or higher)
- **npm** (version 6.x or higher) or **Yarn** (version 1.x or higher)
- **Go** (version 1.16 or higher)
- **Git**

### Frontend Setup

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/forge.git
   ```

2. **Navigate to the Frontend Directory**

   ```bash
   cd forge/src
   ```

3. **Install Dependencies**

   Using npm:

   ```bash
   npm install
   ```

   Or using Yarn:

   ```bash
   yarn install
   ```

4. **Start the Development Server**

   Using npm:

   ```bash
   npm start
   ```

   Or using Yarn:

   ```bash
   yarn start
   ```

   The application should now be running at `http://localhost:3000`.

### Backend Setup

1. **Navigate to the Backend Directory**

   ```bash
   cd forge/backend
   ```

2. **Install Go Modules**

   ```bash
   go mod download
   ```

3. **Run the Backend Server**

   ```bash
   go run main.go
   ```

   The backend server should now be running, typically at `http://localhost:8080`.

## Usage

### Running the Application

With both the frontend and backend servers running, you can access the application in your web browser at `http://localhost:3000`.

### Available Components

- **Window Manager (`WindowManager.jsx`)**: Manages multiple windows or views within the application.
- **Container (`Container.jsx`)**: Handles layouts and rendering of various UI components.
- **File Browser (`FileBrowser.jsx`)**: Allows users to navigate and manage files within the application.
- **Editor (`Editor.jsx`)**: Provides a code or text editor with syntax highlighting using `CodeMirror`.
- **Table Panel (`TablePanel.jsx`)**: Displays data in table format with features like sorting, filtering, and pagination.
- **Control Renderer (`ControlRenderer.jsx`)**: Dynamically renders form controls based on configuration.
- **Chart (`Chart.jsx`)**: Visualizes data using chart components.
- **Layout Renderer (`LayoutRenderer.jsx`)**: Builds complex nested page layouts declared in metadata.
- **Splitter (`Splitter.jsx`)**: Adds resizable split-pane layouts.
- **Form Renderer (`FormRenderer.jsx`)**: Auto-generates forms from JSON-Schema or UI metadata.
- **Tree Multi-Select (`TreeMultiSelect.jsx`)**: Hierarchical multi-select control.
- **Avatar Icon (`AvatarIcon.jsx`)**: Lightweight Phosphor-icon wrapper used by Chat.
- **Dialog and Modal Components (`ViewDialog.jsx`)**: Manages dialogs and modals within the application.
- **Chat (`Chat.jsx`)**: High-level chat UI with message feed, composer and *dynamic avatar icons* (see below).

#### Dynamic avatar icons in Chat

`Chat` renders an avatar next to every message.  Starting with Forge 1.1 you
can fully control which icon is shown.

1. **Per-message override** – set `iconName` on the message object.

   ```js
   handlers.dataSource.setFormData({
     role: 'assistant',
     iconName: 'Crown',   // <- any icon name from @phosphor-icons/react
     content: 'Welcome back, your Majesty!',
   });
   ```

2. **Per-chat mapping** – pass a static map or function via the `avatarIcons`
   prop:

   ```jsx
   <Chat
     avatarIcons={{
       user: 'UserCircle',
       assistant: 'Smiley',
       tool: 'UserGear',
     }}
   />

   // or
   const pickIcon = (msg) =>
     msg.role === 'assistant' && msg.metadata?.vip ? 'Crown' : 'Smiley';

   <Chat avatarIcons={pickIcon} />
   ```

3. **App-wide default** – set once during bootstrap:

   ```js
   context.handlers.chat.avatarIcons = { user: 'User', assistant: 'Student' };
   ```

4. **YAML screen descriptor** – declare in the container metadata:

   ```yaml
   chat:
     avatarIcons:
       user: UserCircle
       assistant: Student
       tool: SealCheck

   # or dynamic
   chat:
     avatarIconsFn: |
       (msg) => msg.role === 'assistant' && msg.meta?.admin ? 'Crown' : 'Smiley'
   ```

Icons are provided by the
[`@phosphor-icons/react`](https://www.npmjs.com/package/@phosphor-icons/react)
package.  Browse the full catalogue at <https://phosphoricons.com/> and use
the component name (e.g. `SmileyWink`, `UserGear`) as the icon string.

### Backend Services

- **File Service (`file/service.go`)**: Provides file system operations like listing directories and downloading files.
- **Metadata Service (`meta/service.go`)**: Loads and resolves metadata with support for YAML files and `$import` directives.
- **Navigation Handler (`handlers/navigation.go`)**: Fetches navigation data for building menus or navigation trees.
- **Window Handler (`handlers/meta.go`)**: Loads window data and configurations.

## Contributing

We welcome contributions from the community. To contribute:

1. **Fork the Repository**

   Click the "Fork" button on the repository page to create a copy under your GitHub account.

2. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**

   Edit the code to add new features or fix bugs.

4. **Commit Your Changes**

   ```bash
   git commit -am "Add new feature"
   ```

5. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit a Pull Request**

   Go to the original repository and click on "New Pull Request" to submit your changes for review.

Please ensure your code follows the existing code style and includes appropriate comments and documentation.

## License

This project is licensed under the Apache2 License. See the [LICENSE](LICENSE) file for details.


## Acknowledgments

- **Library Author:** Adrian Witas
- **Viant AFS**: For the abstract file system used in the backend services.
- **Blueprint.js**: For the UI components used in the frontend.
- **CodeMirror**: For providing the editor component with syntax highlighting.
