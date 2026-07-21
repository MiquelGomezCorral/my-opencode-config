---
name: python-project-setup
description: "Python project setup and management using the MiquelGomezCorral template. Use for virtual environments (conda), dependency management (uv), editable installs, Jupyter kernels, and project scaffolding."
---

# Python Project Setup & Management (MiquelGomezCorral Template)

## WHEN TO USE THIS SKILL
Use only for the MiquelGomezCorral template or explicit environment, dependency, editable-install, Jupyter-kernel, and scaffolding work. Ordinary Python coding follows the current repository's own tooling and conventions.

Read this file whenever the user asks to:
- Set up or repair the environment for an existing template-based Python project
- Create a new Python project or scaffold a project structure
- Set up a virtual environment or conda environment for a project
- Install dependencies with `uv` or manage `requirements.txt`
- Add a Jupyter kernel linked to a project environment
- Work with the `app/` package (editable installs, `pyproject.toml`)
- Bootstrap, replicate, or explain the MiquelGomezCorral Python template

## TEMPLATE OVERVIEW

**Source:** https://github.com/MiquelGomezCorral/Python-project-template-AI-TL

This template is designed for data science and software development workflows. It favors:
- **conda** for environment creation (Python 3.13)
- **uv** for fast dependency resolution
- **pip install -e .** for editable `app/` package installs
- **ipykernel** for Jupyter notebooks linked to the environment

## DIRECTORY STRUCTURE

```
<project-name>/
├── app/                  # Installable package (editable via pip install -e .)
│   ├── src/              # Core source modules
│   └── scripts/          # Runnable scripts
├── configs/              # YAML / JSON configuration files
├── data/                 # Datasets
│   ├── raw/              # Unprocessed source data
│   └── processed/        # Cleaned / transformed data
├── docs/                 # Project documentation
├── logs/                 # Runtime logs
├── models/               # Serialised model artefacts
├── notebooks/            # Jupyter notebooks for EDA and experimentation
├── .gitignore
├── example.env           # Template for .env secrets (never commit .env)
├── LICENSE
├── pyproject.toml
├── README.md
└── requirements.txt
```

**Key rule:** `app/` is both a folder and a Python package. `pyproject.toml` declares it as an editable install so you can `from src.module import ...` anywhere in the project.

## pyproject.toml (canonical template)

```toml
[project]
name = "app"
version = "0.1.0"

[build-system]
requires = ["setuptools"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["app"]
include = ["src*", "scripts*"]
```

If the user renames the project, update `name` in `[project]` but keep `where = ["app"]` unless they also rename the folder.

## SETUP COMMANDS (run once per project)

```bash
# 1. Create and activate conda environment
conda create --name MY_ENV python=3.13 -y
conda activate MY_ENV

# 2. Install dependencies (uv for speed)
uv pip install -r requirements.txt

# 3. Editable install of the app package
pip install -e .

# 4. Register Jupyter kernel for this environment
uv pip install ipykernel
python -m ipykernel install --user --name=MY_ENV --display-name "MY_ENV (Conda)"
```

Replace `MY_ENV` with the project name everywhere.

## COMMON TASKS

### Create a new project from scratch

```bash
mkdir <project-name> && cd <project-name>
# Clone or copy template structure, then:
conda create --name <project-name> python=3.13 -y
conda activate <project-name>
uv pip install -r requirements.txt
pip install -e .
```

### Add a new dependency

```bash
# Install and then pin it:
uv pip install <package>
uv pip freeze | grep <package> >> requirements.txt
# Or edit requirements.txt manually, then:
uv pip install -r requirements.txt
```

### Reproduce an existing project environment

```bash
conda create --name <project-name> python=3.13 -y
conda activate <project-name>
uv pip install -r requirements.txt
pip install -e .
```

### Re-register the Jupyter kernel (after env rebuild)

```bash
python -m ipykernel install --user --name=<env-name> --display-name "<env-name> (Conda)"
```

### Remove environment

```bash
conda deactivate
conda remove --name <env-name> --all -y
```

## IMPORTING FROM app/

Because the package is installed as editable, use:

```python
from src.my_module import my_function   # maps to app/src/my_module.py
from scripts.run import main            # maps to app/scripts/run.py
```

No `sys.path` hacks needed; `pip install -e .` handles discovery via `pyproject.toml`.

## NOTES & PITFALLS

- **Never commit `.env`** — only commit `example.env` with placeholder values.
- If `uv` is not found, install it globally with `pip install uv` or `pipx install uv`.
- On macOS/Linux, `conda activate` may require `conda init bash` (or `zsh`) first.
- Python version in the template is **3.13**; adjust if the project requires an older version.
- `pyproject.toml` uses `where = ["app"]`, so `setuptools` looks for packages inside `app/`. Sub-packages must have `__init__.py`.
- `requirements.txt` is the single source of truth for dependencies; do not duplicate them in `pyproject.toml` `[project.dependencies]` unless packaging for distribution.
