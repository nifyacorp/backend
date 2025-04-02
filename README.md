# NIFYA Backend Orchestration Service

A comprehensive API backend designed for LLM-powered notification and subscription management, orchestrating content processing across multiple AI models.

## 🧠 LLM Integration Features

- **Multi-Model Orchestration**: Seamlessly routes processing tasks to specialized LLMs based on content type
- **Context-Aware Processing**: Maintains user context and preferences across the AI processing pipeline
- **Structured Data Extraction**: Transforms unstructured content into standardized notification formats
- **Model-Agnostic Architecture**: Supports pluggable LLM providers (OpenAI, Gemini, Claude, etc.)
- **Efficient Prompting System**: Optimizes token usage with dynamic prompt templating
- **Streaming Response Integration**: Supports both streaming and batch processing modes
- **Metadata Enrichment**: Attaches model-generated metadata for enhanced notification classification
- **Confidence Scoring**: Includes LLM confidence metrics for generated content

## 🔄 AI Pipeline Components

The service functions as a neural orchestration layer, connecting various components:

### Input Processing
- **Content Scraping**: Extracts text from various sources (BOE, real estate listings, DOGA)
- **Document Chunking**: Splits long documents for efficient LLM processing
- **Prompt Construction**: Dynamically builds prompts based on subscription type and user preferences

### LLM Processing
- **Model Selection**: Routes content to appropriate specialized models
- **Parallel Processing**: Distributes work across multiple LLM instances for efficiency
- **Token Optimization**: Minimizes token usage through efficient prompt engineering
- **Entity Recognition**: Extracts key entities from source documents
- **Summarization**: Generates concise, relevant summaries based on user interests

### Output Processing
- **Response Merging**: Combines multi-chunk LLM outputs into coherent notifications
- **Format Standardization**: Ensures consistent structure regardless of source model
- **Relevance Filtering**: Applies post-processing to enhance signal-to-noise ratio
- **Notification Enrichment**: Adds metadata for improved user experience

## 📊 Technical Architecture

```
┌─────────────────────┐     ┌────────────────┐     ┌───────────────────┐
│ Content Sources     │     │ LLM Processing │     │ User Interface    │
├─────────────────────┤     ├────────────────┤     ├───────────────────┤
│ ● BOE Documents     │     │ ● OpenAI       │     │ ● React Frontend  │
│ ● Real Estate Data  │◄───►│ ● Gemini       │◄───►│ ● Mobile Apps     │
│ ● DOGA Publications │     │ ● Claude       │     │ ● Email Digest    │
└─────────────────────┘     └────────────────┘     └───────────────────┘
           ▲                        ▲                        ▲
           │                        │                        │
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   NIFYA Backend Orchestration Layer                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
│  │ Auth Service   │   │ Subscription Mgmt │   │ Notification Mgmt  │ │
│  └────────────────┘   └──────────────────┘   └────────────────────┘ │
│                                                                      │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
│  │ Neural Router  │   │ Prompt Templates │   │ Response Formatter │ │
│  └────────────────┘   └──────────────────┘   └────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PostgreSQL + Vector Database                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 🧪 LLM Integration Points

### 1. Subscription Creation
- Analyzes user-provided keywords and interests
- Generates optimized search parameters for content sources
- Creates efficient LLM instruction templates based on user intent

### 2. Content Processing
- Routes content to specialized domain-specific models
- Maintains processing threads for multi-part documents
- Applies user context to enhance relevance determination

### 3. Notification Generation
- Transforms model outputs into user-friendly notifications
- Extracts key entities and relationships
- Generates summaries with varying detail levels based on notification medium

### 4. Feedback Integration
- Captures user engagement signals
- Refines model prompts based on user feedback
- Adjusts relevance thresholds to optimize notification quality

## 🛠️ LLM-Optimized Components

### Neural Routing System
Intelligently distributes work across different AI models:

```javascript
// Example neural router implementation
async function routeToOptimalModel(content, userPreferences) {
  const contentType = detectContentType(content);
  const complexity = assessComplexity(content);
  const userContext = extractUserContext(userPreferences);
  
  // Select optimal model based on content characteristics
  if (contentType === 'legal' && complexity > 0.7) {
    return await processWithLegalSpecialist(content, userContext);
  } else if (contentType === 'real-estate') {
    return await processWithPropertyAnalyzer(content, userContext);
  } else {
    // Default general-purpose model
    return await processWithGeneralModel(content, userContext);
  }
}
```

### Dynamic Prompt Assembly
Constructs efficient prompts to minimize token usage:

```javascript
// Example prompt template system
function constructPrompt(content, subscription, templateType) {
  const baseTemplate = templates[templateType];
  const userKeywords = subscription.prompts || [];
  const systemContext = `Focus on these key areas: ${userKeywords.join(', ')}`;
  
  // Construct optimized multi-part prompt
  return {
    system: systemContext,
    user: baseTemplate.replace('{content}', content)
  };
}
```

### Vector-Enhanced Relevance Scoring
Uses embedding similarity to determine notification relevance:

```javascript
// Example relevance determination
async function determineRelevance(processedContent, userProfile) {
  // Generate embeddings for content and user interests
  const contentEmbedding = await generateEmbedding(processedContent);
  const userInterests = await getUserInterestEmbeddings(userProfile.id);
  
  // Calculate similarity scores
  const similarities = userInterests.map(interest => 
    cosineSimilarity(contentEmbedding, interest.embedding)
  );
  
  // Return relevance score and confidence
  return {
    relevanceScore: Math.max(...similarities),
    confidence: calculateConfidenceMetric(similarities),
    isRelevant: Math.max(...similarities) > RELEVANCE_THRESHOLD
  };
}
```

## 📝 Model Interaction Examples

### Document Analysis System
```javascript
// Example of document analyzer with chunking
async function analyzeDocument(document, subscription) {
  // Step 1: Split large document into manageable chunks
  const chunks = documentChunker.splitDocument(document, {
    maxTokens: 8000,
    overlapTokens: 200
  });
  
  // Step 2: Process each chunk with appropriate LLM
  const modelResponses = await Promise.all(chunks.map(async chunk => {
    const prompt = promptBuilder.buildAnalysisPrompt(chunk, subscription);
    return llmClient.generateCompletion({
      model: selectOptimalModel(chunk, subscription),
      prompt: prompt,
      temperature: 0.2,
      max_tokens: 1500
    });
  }));
  
  // Step 3: Merge responses and extract key information
  return responseProcessor.mergeAndExtract(modelResponses, {
    subscription_type: subscription.type,
    extraction_schema: schemas[subscription.type],
    user_keywords: subscription.prompts
  });
}
```

### Notification Generation System
```javascript
// Example notification generator
async function generateNotification(analysisResult, subscription) {
  // Step 1: Extract key information based on subscription type
  const extractedInfo = extractorService.getRelevantInformation(
    analysisResult, 
    subscription.type,
    subscription.prompts
  );
  
  // Step 2: Generate notification content with specialized model
  const notificationContent = await llmClient.generateCompletion({
    model: 'notification-optimized-model',
    prompt: promptBuilder.buildNotificationPrompt(extractedInfo, subscription),
    temperature: 0.7,
    max_tokens: 250
  });
  
  // Step 3: Process and format the notification
  return {
    title: notificationContent.title || extractTitle(notificationContent),
    content: notificationContent.content || formatContent(notificationContent),
    metadata: {
      source_type: subscription.type,
      entity_type: extractedInfo.entityType,
      confidence_score: analysisResult.confidence,
      keywords: extractKeywords(notificationContent),
      sentiment: analyzeSentiment(notificationContent)
    }
  };
}
```

## 🔍 Subscription and Notification Structure

### Subscription JSON Schema
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "user_id": { "type": "string", "format": "uuid" },
    "name": { "type": "string" },
    "type": { "type": "string", "enum": ["BOE", "DOGA", "real-estate"] },
    "prompts": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Keywords and interests for LLM focus"
    },
    "frequency": { 
      "type": "string", 
      "enum": ["immediate", "daily", "weekly"] 
    },
    "ai_settings": {
      "type": "object",
      "properties": {
        "preferred_model": { "type": "string" },
        "summary_length": { "type": "string", "enum": ["short", "medium", "long"] },
        "notification_confidence_threshold": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  },
  "required": ["user_id", "name", "type", "prompts"]
}
```

### Notification JSON Schema
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "user_id": { "type": "string", "format": "uuid" },
    "subscription_id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "content": { "type": "string" },
    "source_url": { "type": "string", "format": "uri" },
    "created_at": { "type": "string", "format": "date-time" },
    "read": { "type": "boolean" },
    "metadata": {
      "type": "object",
      "properties": {
        "entity_type": { "type": "string" },
        "ai_generated": { "type": "boolean" },
        "model_used": { "type": "string" },
        "confidence_score": { "type": "number" },
        "processing_time_ms": { "type": "number" },
        "token_usage": {
          "type": "object",
          "properties": {
            "prompt_tokens": { "type": "number" },
            "completion_tokens": { "type": "number" },
            "total_tokens": { "type": "number" }
          }
        },
        "extracted_entities": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": { "type": "string" },
              "value": { "type": "string" },
              "confidence": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

## 📈 AI Performance Metrics

The system collects detailed metrics on LLM performance:

- **Processing Latency**: Time taken for complete document analysis
- **Token Efficiency**: Tokens used per notification generated
- **Model Accuracy**: Relevance ratings from user feedback
- **Entity Extraction Precision**: Accuracy of extracted key information
- **Confidence Distribution**: Histogram of model confidence scores
- **Cost Optimization**: Dollar cost per notification across models

## 🔧 Development Guide

### Environment Setup
```bash
# Install dependencies
npm install

# Configure development environment
cp .env.example .env
# Edit .env with your LLM API keys

# Run in development mode
npm run dev
```

### Testing LLM Integration
```bash
# Run the LLM integration tests
npm run test:llm

# Test specific models
npm run test:llm -- --model=gpt-4-turbo

# Measure token efficiency
npm run benchmark:tokens

# Test prompt templates
npm run validate:prompts
```

### Prompt Template Development
The system uses a structured prompt template system to optimize LLM interactions:

```
/templates
├── boe/
│   ├── analysis.prompt.js     # Initial document analysis
│   ├── extraction.prompt.js   # Entity extraction
│   └── notification.prompt.js # Notification generation
├── real-estate/
│   ├── analysis.prompt.js
│   ├── extraction.prompt.js
│   └── notification.prompt.js
└── shared/
    ├── base.prompt.js         # Base prompt structure
    └── system.prompt.js       # System context
```

## 🌐 Neural Network Architecture

The service employs a neural routing architecture to optimize model selection:

1. **Content Analysis Layer**: Evaluates document characteristics
2. **User Context Layer**: Incorporates user preferences
3. **Model Selection Layer**: Chooses optimal LLM for the task
4. **Response Processing Layer**: Standardizes outputs

This architecture ensures:
- Efficient resource utilization
- Optimal quality for each content type
- Consistent user experience across models
- Graceful fallback to alternative models

## 🔑 API Authentication

Protected endpoints require:
1. JWT token in Authorization header:
   ```
   Authorization: Bearer <token>
   ```
2. User ID in custom header:
   ```
   X-User-ID: <user-id>
   ```

## 📱 Integration with Frontend

The backend provides a unified API for frontend applications:

- **REST API**: Standard endpoints for CRUD operations
- **WebSocket API**: Real-time notification delivery
- **GraphQL API**: Flexible data fetching (experimental)

Frontend applications can leverage:
- Real-time notification updates
- Subscription management interfaces
- User preference configuration
- Notification timeline visualization

## 🚀 Deployment

```bash
# Build for production
npm run build

# Deploy to Google Cloud Run
gcloud run deploy backend \
  --image gcr.io/PROJECT_ID/backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars NODE_ENV=production
```

## 📚 Further Documentation

- [API Documentation](./api-docs.md)
- [LLM Integration Guide](./llm-integration.md)
- [Database Schema](./db-schema.md)
- [Deployment Guide](./deployment.md)
- [Troubleshooting](./troubleshooting.md)

---

Built with ❤️ by the NIFYA Team