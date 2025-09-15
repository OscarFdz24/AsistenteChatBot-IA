from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from app.models import db, User, Conversation, Message
import os
from dotenv import load_dotenv
from google import genai

# ------------------------------
# Cargar variables de entorno
# ------------------------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ------------------------------
# Inicializar cliente Gemini
# ------------------------------
client = genai.Client(api_key=GEMINI_API_KEY)

# ------------------------------
# Blueprint
# ------------------------------
main = Blueprint(
    "main",
    __name__,
    template_folder="templates"
)

# ------------------------------
# Helpers
# ------------------------------
def get_current_user():
    user_id = session.get("user_id")
    if user_id:
        return User.query.get(user_id)
    return None

# ------------------------------
# Rutas de usuario
# ------------------------------
@main.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("register.html")

    data = request.form
    username = data.get("username")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")

    if not username or not email or not password:
        return "Faltan datos obligatorios", 400

    if User.query.filter_by(username=username).first():
        return "El usuario ya existe", 400

    hashed_pw = generate_password_hash(password)
    user = User(username=username, email=email, phone=phone, password=hashed_pw)
    db.session.add(user)
    db.session.commit()

    # Guardar sesión y cookie
    session["user_id"] = user.id
    resp = make_response(redirect(url_for("main.chat")))
    resp.set_cookie("user_id", str(user.id), max_age=7*24*3600)  # 7 días
    return resp

@main.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    data = request.form
    email = data.get("email")
    password = data.get("password")
    remember = data.get("remember")

    if not email or not password:
        return "Email y contraseña son requeridos", 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return "Email o contraseña incorrectos", 400

    # Guardar sesión y cookie si "remember" está marcado
    session["user_id"] = user.id
    resp = make_response(redirect(url_for("main.chat")))
    
    if remember:
        resp.set_cookie("user_id", str(user.id), max_age=7*24*3600)  # 7 días
    
    return resp

@main.route("/logout")
def logout():
    session.pop("user_id", None)
    resp = make_response(redirect(url_for("main.home")))
    resp.set_cookie("user_id", "", expires=0)
    return resp

# ------------------------------
# Página de inicio
# ------------------------------
@main.route("/", methods=["GET"])
def home():
    # Check if user is already logged in via session or cookie
    user_id = session.get("user_id")
    if not user_id:
        user_id = request.cookies.get("user_id")
        if user_id:
            session["user_id"] = user_id
    
    if user_id:
        user = User.query.get(user_id)
        if user:
            return redirect(url_for("main.chat"))
    
    return render_template("home.html")

# ------------------------------
# Chat con IA
# ------------------------------
@main.route("/chat", methods=["GET", "POST"])
def chat():
    user = get_current_user()
    if not user:
        return redirect(url_for("main.login"))

    # GET: mostrar chat
    if request.method == "GET":
        # Cargar conversaciones del usuario
        conversations = Conversation.query.filter_by(user_id=user.id).order_by(Conversation.created_at.desc()).all()
        return render_template("chat.html", user=user, conversations=conversations)

    # POST: recibir mensaje y generar respuesta IA
    data = request.get_json()
    user_message = data.get("message")

    if not user_message:
        return jsonify({"reply": "No recibí ningún mensaje 😅"}), 400

    # Guardar mensaje del usuario
    conversation_id = data.get("conversation_id")
    if conversation_id:
        conversation = Conversation.query.get(conversation_id)
    else:
        conversation = Conversation(user_id=user.id, title="Nueva conversación")
        db.session.add(conversation)
        db.session.commit()

    user_msg = Message(sender="user", text=user_message, conversation_id=conversation.id)
    db.session.add(user_msg)
    db.session.commit()

    try:
        # Llamada al SDK de Gemini
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_message
        )
        ai_reply_text = response.text or "No entendí tu mensaje 😅"

        # Guardar mensaje IA
        ai_msg = Message(sender="ai", text=ai_reply_text, conversation_id=conversation.id)
        db.session.add(ai_msg)
        db.session.commit()

    except Exception as e:
        ai_reply_text = f"Error al conectarse a Gemini: {str(e)}"

    return jsonify({"reply": ai_reply_text, "conversation_id": conversation.id})

# ------------------------------
# Guest Chat (sin autenticación)
# ------------------------------
@main.route("/guest_chat", methods=["GET", "POST"])
def guest_chat():
    if request.method == "GET":
        return render_template("guest_chat.html")
    
    # POST: procesar mensaje de invitado
    data = request.get_json()
    user_message = data.get("message")
    
    if not user_message:
        return jsonify({"reply": "No recibí ningún mensaje 😅"}), 400
    
    try:
        # Llamada al SDK de Gemini
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_message
        )
        ai_reply_text = response.text or "No entendí tu mensaje 😅"
    except Exception as e:
        ai_reply_text = f"Error al conectarse a Gemini: {str(e)}"
    
    return jsonify({"reply": ai_reply_text})

# ------------------------------
# API para cargar mensajes de conversación
# ------------------------------
@main.route("/conversation/<int:conversation_id>/messages", methods=["GET"])
def get_conversation_messages(conversation_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "No autorizado"}), 401
    
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user.id).first()
    if not conversation:
        return jsonify({"error": "Conversación no encontrada"}), 404
    
    messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.created_at.asc()).all()
    
    return jsonify({
        "title": conversation.title,
        "messages": [
            {
                "text": msg.text,
                "sender": msg.sender,
                "created_at": msg.created_at.isoformat()
            }
            for msg in messages
        ]
    })

# ------------------------------
# Eliminar conversación
# ------------------------------
@main.route("/conversation/<int:conversation_id>/delete", methods=["DELETE"])
def delete_conversation(conversation_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "No autorizado"}), 401
    
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user.id).first()
    if not conversation:
        return jsonify({"error": "Conversación no encontrada"}), 404
    
    # Eliminar todos los mensajes de la conversación
    Message.query.filter_by(conversation_id=conversation_id).delete()
    
    # Eliminar la conversación
    db.session.delete(conversation)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Conversación eliminada correctamente"})

# ------------------------------
# Editar nombre de conversación
# ------------------------------
@main.route("/conversation/<int:conversation_id>/edit", methods=["PUT"])
def edit_conversation(conversation_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "No autorizado"}), 401
    
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=user.id).first()
    if not conversation:
        return jsonify({"error": "Conversación no encontrada"}), 404
    
    data = request.get_json()
    new_title = data.get("title", "").strip()
    
    if not new_title:
        return jsonify({"error": "El título no puede estar vacío"}), 400
    
    if len(new_title) > 100:
        return jsonify({"error": "El título no puede tener más de 100 caracteres"}), 400
    
    conversation.title = new_title
    db.session.commit()
    
    return jsonify({"success": True, "title": new_title, "message": "Nombre actualizado correctamente"})