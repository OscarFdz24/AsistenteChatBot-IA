import os

# Simularemos la IA de Gemini (de momento devuelve texto estático)
# Más adelante, aquí iría la integración real con la API de Gemini

def get_gemini_reply(user_message):
    # Por ejemplo, podemos responder igual que un chatbot simple
    return f"Gemini dice: {user_message[::-1]}"  # Ejemplo: invierte el texto