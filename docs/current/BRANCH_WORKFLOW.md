# Branch Workflow

Last updated: April 20, 2026

This document defines the default branch intent for work in this repository.

## Branch Roles

- `main`
  - stable
  - intentional
  - releasable
- `dev`
  - active integration branch
  - rapid iteration
  - in-progress app work
  - cleanup and exploratory implementation

## Default Placement Rules

- Prefer active desktop app feature work on `dev`.
- Prefer release tags and release publishing from `main`.
- Prefer landing/docs/process/infrastructure changes on `main` when they are stable on their own.
- Do not mix unrelated `dev` app work into `main` release-prep commits.

## Decision Guide

Choose `main` when the change is:

- release preparation
- release documentation
- stable process guidance
- landing-site or download-flow work that is ready on its own

Choose `dev` when the change is:

- renderer feature work
- main/preload runtime behavior work
- assistant/app interaction work
- cleanup or refactor tied to active app iteration

## Release Boundary

- Tag and publish releases from `main`, not `dev`.
- If release work depends on unfinished app changes still living on `dev`, land or merge intentionally before tagging.

## When To Update This Doc

Update this file when:

- the repo changes its default integration branch
- release branch policy changes
- landing/docs/process changes should follow a different branch path
