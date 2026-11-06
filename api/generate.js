export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    
    // Note: Backend variables do NOT use VITE_ prefix
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY on Vercel' });
    }

    // Using Gemini 3 Flash for speed and accuracy
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ 
        parts: [{ text: `Create high-yield study flashcards from the following presentation text. Extract key concepts, definitions, and facts.\n\nText:\n${text}` }] 
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              q: { type: "STRING" }, // Question
              a: { type: "STRING" }  // Answer
            },
            required: ["q", "a"]
          }
        }
      },
      systemInstruction: {
        parts: [{ text: "You are an expert educator. Extract the most important concepts and definitions from the provided presentation text and create a list of concise Q&A flashcards. Keep answers focused and clear. Always output JSON using 'q' for the question and 'a' for the answer." }]
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
       const errData = await response.text();
       throw new Error(`Gemini API rejected the request: ${errData}`);
    }

    const data = await response.json();
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!contentText) throw new Error("AI returned an empty response.");
    
    const flashcards = JSON.parse(contentText);
    
    // Send the beautiful flashcards back to your React frontend!
    res.status(200).json({ flashcards });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}
