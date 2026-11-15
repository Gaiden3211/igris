# Conversational agent and retrieval design — 15 November 2026

Scope: primary-source research for improving the existing Clarke/Supabase research assistant. This is a design note, not a claim that any specific change has passed live scientific-quality evaluation. Recommendations below are engineering inferences applied to Igris; quoted benchmark gains are deliberately omitted because they do not predict this corpus.

## Keep the workflow small

Anthropic distinguishes code-directed workflows from model-directed autonomous agents and recommends starting with the simplest useful architecture. LangChain documents both direct retrieval-before-generation and more flexible agentic retrieval, with different latency/control trade-offs. An existing SQL knowledge base can be queried directly; replacing the storage or installing an agent framework is not a prerequisite. Sources: [Anthropic, Building effective agents](https://www.anthropic.com/research/building-effective-agents), [LangChain, Retrieval](https://docs.langchain.com/oss/javascript/deepagents/retrieval).

For Igris, retain a bounded pipeline: understand the current turn and resolve references → retrieve if necessary → generate a grounded response. Reserve a second search for an explicit gap or weak initial results, with a hard cap. A new free-running agent loop would add complexity without first correcting the known retrieval and conversation failures.

## Conversation is separate from scientific evidence

NVIDIA's multi-turn RAG reference separates history supplied to response generation from query rewriting used by retrieval. Rewriting turns a context-dependent follow-up into a standalone search question; it adds a model call, while simple history concatenation is a lower-latency alternative. Source: [NVIDIA, Multi-turn conversation support](https://docs.nvidia.com/rag/latest/multiturn.html).

Igris should keep actual recent user/assistant turns for conversational continuity and let Clarke generate capability explanations, follow-ups, reformulations and clarifying questions. Do not substitute a fixed greeting paragraph. Old assistant answers can resolve “that study” but cannot serve as new scientific evidence. Combine routing and standalone query rewriting in the existing planner, rather than adding another always-on model call. A new named study should override stale comparison focus; an ambiguous pronoun should preserve the clearly referenced subject or prompt a clarification.

## Retrieve the requested evidence, not a broad pile of records

Lexical retrieval is useful for exact identifiers and technical terms; Anthropic describes combining lexical and semantic results through rank fusion and retaining chunk context. Supabase documents full-text operators and reciprocal-rank fusion for hybrid search. Sources: [Anthropic, Contextual retrieval](https://www.anthropic.com/research/contextual-retrieval), [Supabase, Full-text search](https://supabase.com/docs/guides/database/full-text-search), [Supabase, Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search).

Immediate Igris priorities:

- Exact study detail/comparison requests should use the resolved requested studies, rather than always adding unrelated top-ranked investigations up to the eight-record cap.
- Search relevant passages within selected studies; preserve filename, row/page, headers, evidence type and catalog relationship. A global top-12 passage search can crowd out passages for the requested investigation.
- Search saved reviewed-source text as well as a short hand-maintained keyword list. Treat a registry match as topic evidence unless its catalog association supports study identity.
- Distinguish “no exact catalog match,” “no relevant passage retrieved,” and “the corpus has no indexed text for this question.” Do not claim a paper does not exist because retrieval missed it.
- Show sources actually cited in the answer separately from additional retrieved matches. Keep unused matches available, but avoid implying every displayed card supports the final prose.

Adding embeddings or a reranker is a later option if measured synonym/semantic misses remain. Existing exact resolution, full-text search and rank fusion should first be tested with real failing questions.

## A model reviewer is a fallible component

OpenAI's evaluation guidance notes judge biases, requires clear rubrics, and recommends checking agreement with human annotations; it does not establish a judge's verdict as ground truth. Source: [OpenAI, Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

For Igris, retain deterministic checks for invalid citation IDs, authored destinations and incomplete generation. Do not apply scientific verification to greetings or self-description. If semantic review stays on the live path, return specific unsupported claims/reasons and permit at most one grounded repair; a bare rejected verdict should not silently destroy an otherwise useful answer. If no supported answer remains, explain the precise evidence gap. Judge-format failure, provider timeout and scientific disagreement are different failure classes and should not all look like missing sources. This policy is a design recommendation and needs real-model testing.

## Latency and basic chat behavior

OpenAI recommends measuring first-visible-token and end-to-end latency separately, reducing sequential requests, and filtering irrelevant context. Streaming improves when users can start reading; a fully buffered draft cannot provide that benefit. Source: [OpenAI, Latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization).

For each request, measure plan/search/generate/review durations and input/output token counts without logging credentials or private conversation text. Stream actual model text for conversational turns. For research replies, explicitly choose whether the product streams grounded text with final citation checks or waits for review; do not call a fully buffered answer “live streaming.” Bound timeouts across complete stream consumption, and preserve a stopped partial response as incomplete rather than presenting it as finished.

Vercel's chat examples expose streaming, stop, regeneration/error recovery, and per-message copy/retry actions. These are interaction references, not a reason to replace Astryx or install another SDK. Copy is an asynchronous browser operation and can fail. Sources: [AI SDK, Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), [AI Elements, Message actions](https://elements.ai-sdk.dev/components/message), [MDN, Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText).

Use message actions with accessible labels, a visible copied/failed state, retry of the same user turn, disabled duplicate sends during generation, and a working stop button. Keep the user's requested quota switch server-side, remove remaining-message counters, and report exhaustion only when enforced. Quota policy is a project requirement rather than a research-derived behavior.
