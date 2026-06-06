# Private GitHub Setup

## Create the Repository

1. Sign in to GitHub and select **New repository**.
2. Name it `fabio-edge-research-lab`.
3. Select **Private**.
4. Do not initialize it with a README, `.gitignore`, or license because this local project already contains them.
5. Create the repository and copy its HTTPS or SSH URL.

From the project root:

```powershell
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
git remote add origin https://github.com/YOUR_ACCOUNT/fabio-edge-research-lab.git
git remote -v
git push -u origin main
```

SSH alternative:

```powershell
git remote add origin git@github.com:YOUR_ACCOUNT/fabio-edge-research-lab.git
git push -u origin main
```

## Invite the Collaborator

1. Open the private repository on GitHub.
2. Open **Settings**.
3. Select **Collaborators** or **Collaborators and teams** under access settings.
4. Select **Add people**.
5. Search for the collaborator's GitHub username or email.
6. Grant write access and send the invitation.
7. Ask the collaborator to accept the invitation before cloning.

## Protect `main`

GitHub rulesets are the preferred current interface:

1. Open **Settings**.
2. Select **Rules**, then **Rulesets**.
3. Select **New ruleset** and create a branch ruleset.
4. Target the default branch, `main`.
5. Set enforcement to **Active**.
6. Enable **Require a pull request before merging**.
7. Require at least one approving review.
8. Enable dismissal of stale approvals when new commits are pushed.
9. Block force pushes and branch deletion.
10. Save the ruleset.

If rulesets are unavailable on the account plan, use **Settings > Branches > Add branch protection rule** and apply the equivalent rules to `main`.

Official references:

- https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
- https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

## Optional Required Checks

After GitHub Actions or another CI service reports checks on pull requests:

1. Edit the `main` ruleset.
2. Enable **Require status checks to pass**.
3. Select the build, lint, backend test, and secret-check jobs.
4. Require the branch to be up to date before merging if both collaborators agree to that workflow.

Do not enable a required status check before the check exists, or all pull requests may become unmergeable.
