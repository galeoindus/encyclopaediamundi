/** Small, deterministic conversation helpers used by Amigo's Auto mode.
 *
 * Auto mode deliberately favours research for factual questions. The explicit
 * Conversation mode remains available for creative work and open-ended chat.
 */
const GREETINGS = /^(?:hi+(?:\s+there)?|hey+(?:\s+there)?|hello(?:\s+there)?|yo|hiya|namaste|namaskar|salaam|salam|hola|नमस्ते|नमस्कार|हाय|हैलो|हेलो)(?:[,\s]+(?:amigo|दोस्त))?(?:[,\s]+(?:how are you(?: doing)?|how is it going|what'?s up|आप कैसे हैं|कैसे हैं|क्या हाल है))?[\s!,.?]*$/iu;
const SOCIAL = /^(?:how are you(?: doing)?|how is it going|what'?s up|what'?s new|i'?m doing well|i am (?:good|great|fine|okay)|thanks?|thank you|thx|ty|okay|ok|cool|great|nice|good morning|good afternoon|good evening|good night|bye|goodbye|see you|who are you|what are you|what is your name|what'?s your name|tell me about yourself|are you an? ai|what can you do|how do you work|आप कैसे हैं|कैसे हैं|क्या हाल है|धन्यवाद|शुक्रिया|ठीक है|अलविदा|आप कौन हैं|आपका नाम क्या है|आप क्या कर सकते हैं)(?:[,\s]+(?:amigo|दोस्त))?[\s.!?]*$/iu;
const CREATIVE = /^(?:please\s+)?(?:write|draft|compose|rewrite|proofread|polish|translate|brainstorm|plan|outline|design|create|generate|summari[sz]e this|make this|turn this into|help me (?:write|plan|prepare|organize|practice)|tell me a joke|make me laugh|role.?play|pretend|tell me a story)\b|^(?:(?:can|could|would) you (?:please )?(?:write|draft|compose|rewrite|proofread|polish|translate|brainstorm|plan|outline|design|create|generate|make me laugh|tell me a joke|help me (?:write|plan|prepare|organize|practice))|i want you to (?:write|draft|compose|rewrite|translate|brainstorm|plan|design|create|generate)|i'?d like you to (?:write|draft|compose|translate|plan|design|create)|let'?s (?:brainstorm|plan|write|create)|make (?:a|an|me) (?:logo|story|poem|plan|draft|checklist|schedule))\b|^(?:लिख(?:ो|िए|ना)|अनुवाद|सुधार(?:ो|ें)|योजना बनाओ|कविता|कहानी|मज़ाक|चुटकुला|पत्र लिख|मुझे .*?(?:कविता लिख|कहानी सुन|पत्र लिख|योजना बनाकर|अनुवाद कर)|कृपया .*?(?:लिख|बनाइए|बनाओ|अनुवाद))/iu;
const PERSONAL_CHAT = /^(?:i(?:'m| am) (?:feeling|bored|tired|happy|sad|excited|upset|lonely)|i feel\b|i had a (?:bad|great|long) day|let'?s (?:talk|chat)|can we (?:talk|chat)|i just wanted to say|i could use someone to talk to|मुझे (?:आपसे बात करनी है|बात करनी है|अच्छा|बुरा|थोड़ा|थोड़ी|लगता)|मैं (?:ठीक|अच्छा|अच्छी|परेशान|उदास)|चलो बात)/iu;
const PERSONAL_STATEMENT = /^(?:i(?:'m| am| got| just| feel| had| have| love| hate| enjoy| prefer| think| believe)\b|my\s+\w+|we\s+(?:are|'re|have|had|just|think|feel)|मेरा\s+|मेरी\s+|मैं\s+|मुझे\s+|हम\s+)/iu;
const RESEARCH_INTENT = /^(?:i want to (?:know|learn|understand)|i'?d like to (?:know|learn|understand)|i am curious about|i'm curious about|i have a question about|मुझे .*?(?:जानना|समझना) है|मैं .*?(?:जानना|समझना) चाहता)/iu;
const SITE_HELP = /\b(?:Veridell|this site|this website|the website|site features|website features|how (?:does|do) (?:this site|this website|Veridell) work|what can i do on (?:this site|this website)|how to use (?:this site|this website)|site privacy|site navigation)\b|एनसाइक्लोपीडिया मुंडी|एनसाइक्लोपीडिया मुंडी|इस (?:साइट|वेबसाइट)|वेबसाइट के बारे में|साइट के बारे में/iu;
const CASUAL_ACK = /^(?:that'?s (?:great|nice|interesting|helpful)|sounds good|i agree|same here|good point|awesome|बहुत अच्छा|अच्छा|समझ गया|समझ गई|बहुत बढ़िया|ठीक है धन्यवाद)[.!\s]*$/iu;
const RESEARCH = /^(?:who|what|when|where|why|how|which|whose|is|are|was|were|do|does|did|define|compare|contrast|explain|describe|tell me about|give me (?:the )?(?:facts|history|definition)|what is the difference|how many|how much)\b|^(?:कौन|क्या|कब|कहाँ|क्यों|कैसे|कितना|कितनी|परिभाषा|समझाइए|बताइए)/iu;
const CONTEXTUAL_RESEARCH = /^(?:and\s+)?(?:why|how|when|where|who)[\s?.!]*$|^(?:and\s+)?what about\b|^(?:tell me more|more details|what happened next|and then|how (?:does|did|is|was) (?:it|that|this|he|she|they|his|her|their)\b|why (?:does|did|is|was) (?:it|that|this|he|she|they|his|her|their)\b|इसके बारे में|और क्यों|फिर क्या|उसका कारण|इसके कारण|और बताइए)/iu;
const CONTEXTUAL_CHAT = /^(?:make (?:it|that|this) (?:shorter|simpler|clearer|friendlier|more formal)|explain (?:that|it|this) (?:again|more simply|in simple words)|give (?:me )?(?:an )?example|rephrase (?:that|it|this)|summari[sz]e (?:that|it|this)|translate (?:that|it|this)|continue (?:the story|writing)|what did you mean|elaborate|इसे (?:छोटा|सरल|आसान)|दोबारा समझाइए|एक उदाहरण)/iu;

export function isSmallTalk(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 && text.length <= 100 && (GREETINGS.test(text) || SOCIAL.test(text));
}

export function isContextualFollowUp(value) {
  return CONTEXTUAL_RESEARCH.test(String(value ?? '').trim());
}

export function classifyMessage(value, selectedMode = 'auto', hasHistory = false) {
  const text = String(value ?? '').trim();
  if (selectedMode === 'chat') return 'chat';
  if (selectedMode === 'research') return 'grounded';
  if (!text) return 'grounded';
  if (isSmallTalk(text) || CREATIVE.test(text) || PERSONAL_CHAT.test(text) || CONTEXTUAL_CHAT.test(text) || SITE_HELP.test(text)) return 'chat';
  if (RESEARCH_INTENT.test(text)) return 'grounded';
  if (hasHistory && isContextualFollowUp(text)) return 'grounded';
  if (hasHistory && CASUAL_ACK.test(text)) return 'chat';
  if (RESEARCH.test(text)) return 'grounded';
  if (PERSONAL_STATEMENT.test(text)) return 'chat';
  if (hasHistory && !/[?？]/u.test(text)) return 'chat';
  // A conversational statement is not forced through Wikipedia just because it
  // lacks a question mark. Unknown standalone prompts still default to research.
  return 'grounded';
}

export function conversationHistory(items, maxEntries = 8) {
  const out = [];
  for (const item of (Array.isArray(items) ? items : []).slice(-Math.max(2, maxEntries))) {
    if (item?.type === 'q' && item.text) out.push({ role: 'user', content: String(item.text).slice(0, 600) });
    else if (item?.type === 'a' && item.data?.answer) out.push({ role: 'assistant', content: String(item.data.answer).slice(0, 900) });
  }
  return out.slice(-Math.max(2, maxEntries));
}

export function contextualSearchQuery(question, items) {
  const q = String(question ?? '').trim();
  if (!isContextualFollowUp(q)) return q;
  const prior = Array.isArray(items) ? items : [];
  const lastAnswer = [...prior].reverse().find((item) => item?.type === 'a' && item.data);
  const title = String(lastAnswer?.data?.title ?? '').trim();
  const lastQuestion = [...prior].reverse().find((item) => item?.type === 'q' && item.text)?.text;
  const context = title || String(lastQuestion ?? '').trim();
  return context ? `${context} ${q}`.slice(0, 800) : q;
}

export function normalizeStoredThread(item, makeId) {
  if (!item || typeof item !== 'object' || !String(item.q ?? '').trim()) return null;
  const messages = Array.isArray(item.messages)
    ? item.messages.filter((m) => (m?.type === 'q' && typeof m.text === 'string') || (m?.type === 'a' && m.data && typeof m.data.answer === 'string')).slice(-20)
    : item.answer
      ? [{ type: 'q', text: String(item.q) }, { type: 'a', data: item.answer }]
      : [{ type: 'q', text: String(item.q) }];
  return {
    id: String(item.id || makeId()),
    q: String(item.q).slice(0, 120),
    at: Number(item.at) || Date.now(),
    updatedAt: Number(item.updatedAt) || Number(item.at) || Date.now(),
    messages,
  };
}
