from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import Config
from openai import OpenAI
import os
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from flask_mail import Mail

db = SQLAlchemy()
migrate = Migrate()
login = LoginManager()
csrf = CSRFProtect()
login.login_view = 'auth.login'
login.login_message = 'Por favor, faça login para acessar esta página.'
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
mail = Mail()

def create_app():
    app = Flask(__name__, static_url_path='', static_folder='static', template_folder='templates')
    app.config.from_object(Config)

    # Configuração do banco de dados
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    migrate.init_app(app, db)
    login.init_app(app)
    csrf.init_app(app)
    mail.init_app(app)

    from app import routes
    app.register_blueprint(routes.main)

    from app.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')

    @login.user_loader
    def load_user(id):
        return User.query.get(int(id))

    return app

from app import models
from app.models import User
