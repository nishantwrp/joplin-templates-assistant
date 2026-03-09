# Joplin Templates Assistant

Joplin Templates Assistant (Albus) is an AI powered assitant for writing powerful and dynamic templates for the Joplin note taking app. This assistant can also answer any plugin specific queries (e.g. "How to set default templates for a specific notebook?").

This app also has a playground editor to make edits to generated templates and test how would they work in the actual Joplin app.

## Why?
`v3.0.0` release of joplin templates plugin introduces support for very powerful features like conditions, loops, math helpers, datetime modifiers, etc.

However it may be time & mental bandwidth consuming to learn & use these new features.

With the advent of LLMs, this app aims to make it easier for the end-users to create & use dynamic joplin templates. 

## Architecture
This app uses the real [template-plugin](https://github.com/joplin/plugin-templates) to run your templates. The plugin interacts with a [fake joplin environment](./fake-joplin/) that runs inside the app itself.

> [!NOTE]
> The fake joplin environment is not a generic replica of the actual joplin app. It's built very specific to how templates-plugin interacts with the Joplin Plugin API.


![Architecture](./docs/architecture.png)

## Telemetry and Privacy

Template content is processed locally in the browser and is not stored on any server.

To improve AI response quality, Google Analytics is used to collect anonymous metrics, including:
-   Execution success and failure rates.
-   User feedback on specific LLM model responses.
-   Model performance data such as timeouts and errors.

Note: Chat queries are sent to the configured LLM provider (Gemini or OpenAI) to generate responses.

## Sponsor
This assistant and the templates-plugin are built by [Nishant Mittal](https://nishantwrp.com). Your support helps cover LLM costs and future development!

You can sponsor via [GitHub Sponsors](https://github.com/sponsors/nishantwrp), [PayPal](https://www.paypal.com/paypalme/nishantwrp) or [BuyMeACoffee](https://buymeacoffee.com/nishantwrp).

## Issues and Feedback

-   **For Templates Assistant (this app):** Open an issue in [this repository](https://github.com/nishantwrp/joplin-templates-assistant/issues).
-   **For the Templates Plugin:** Use the [official plugin issue tracker](https://github.com/joplin/plugin-templates/issues).

## Credits
This app was mostly vibe-coded in a weekend using [Gemini CLI](https://geminicli.com). Thanks Google for the generous free tier.

Also, thanks [eraser.io](https://eraser.io) for the architecture diagram.
