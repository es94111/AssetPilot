## 專案治理原則

Please refer to the [Project Charter](.specify/memory/constitution.md) (.specify/memory/constitution.md), which serves as the guiding principle for all development work.

1. Think Before You Code

Don’t make assumptions. Don’t hide your confusion. Present trade-offs.

LLMs often silently choose an interpretation and execute it. This principle enforces explicit reasoning:

State assumptions explicitly — If you’re unsure, ask instead of guessing

Present multiple interpretations — When ambiguity exists, don’t silently choose

Speak up when appropriate — If there’s a simpler way, say so

Pause when confused — Point out what’s unclear and ask for clarification

2. Simplicity First

Solve problems with the least amount of code. Don’t over-speculate.

Counter the tendency toward over-engineering:

Don’t add features beyond what’s required

Don’t create abstractions for one-off code

Don’t add unsolicited “flexibility” or “configurability”

Don’t handle errors for scenarios that can’t happen

If 200 lines of code can be written in 50, rewrite it

Testing criterion: Would a senior engineer find this overly complex? If so, simplify it.

3. Make Precise Changes

Touch only what you must. Clean up only the mess you created.

When editing existing code:

Do not “improve” adjacent code, comments, or formatting

Do not refactor something that isn’t broken

Match the existing style, even if you prefer a different approach

If you notice unrelated dead code, mention it—do not delete it

When your changes create orphaned code:

Remove imports/variables/functions that have become obsolete due to your changes

Do not delete pre-existing dead code unless requested

Verification criterion: Every line of modification should be directly traceable to a user request.

*Translated with [DeepL.com](https://www.deepl.com/?utm_campaign=product&utm_source=web_translator&utm_medium=web&utm_content=copy_free_translation) (free version)*
