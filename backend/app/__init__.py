from flask import Flask
from flask_cors import CORS
from .models import db
from .routes import main

def create_app():
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static"   # <-- esto es clave
    )
    app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+pymysql://root:root@localhost/chatdb"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.secret_key = "supersecret"

    db.init_app(app)
    CORS(app)

    app.register_blueprint(main)

    return app