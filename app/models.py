from app import db
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from datetime import datetime

# Modelos serão adicionados posteriormente

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    email_for_sending = db.Column(db.String(120))
    email_password = db.Column(db.String(128))  # Armazenar de forma segura!
    password_hash = db.Column(db.String(128))
    ideas = db.relationship('Idea', backref='author', lazy='dynamic')
    full_name = db.Column(db.String(100))
    bio = db.Column(db.String(200))
    smtp_server = db.Column(db.String(100))
    smtp_port = db.Column(db.Integer)
    language = db.Column(db.String(2), default='pt')
    timezone = db.Column(db.String(10), default='UTC-3')
    receive_notifications = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Idea(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    description = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    questions = db.relationship('Question', backref='idea', lazy='dynamic')
    tasks = db.relationship('Task', backref='idea', lazy='dynamic')
    expenses = db.relationship('Expense', backref='idea', lazy='dynamic')

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    answer = db.Column(db.Text)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'))

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(20), default='to_do')
    order = db.Column(db.Integer)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'))
    tags = db.relationship('Tag', secondary='task_tags', backref=db.backref('tasks', lazy='dynamic'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    due_date = db.Column(db.DateTime)
    criticality = db.Column(db.Integer, default=0)  # 0: Low, 1: Medium, 2: High

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

task_tags = db.Table('task_tags',
    db.Column('task_id', db.Integer, db.ForeignKey('task.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

class SWOT(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    idea = db.relationship('Idea', backref=db.backref('swot', uselist=False))
    analyses = db.relationship('SWOTAnalysis', back_populates='swot', lazy='dynamic')

class SWOTAnalysis(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    swot_id = db.Column(db.Integer, db.ForeignKey('swot.id'))
    content = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    swot = db.relationship('SWOT', back_populates='analyses')

class SWOTItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    swot_id = db.Column(db.Integer, db.ForeignKey('swot.id'))
    category = db.Column(db.String(20))  # 'strength', 'weakness', 'opportunity', 'threat'
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    swot = db.relationship('SWOT', backref=db.backref('items', lazy='dynamic'))

class ExpenseCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

expense_tags = db.Table('expense_tags',
    db.Column('expense_id', db.Integer, db.ForeignKey('expense.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    category_id = db.Column(db.Integer, db.ForeignKey('expense_category.id'), nullable=False)
    category = db.relationship('ExpenseCategory', backref='expenses')
    tags = db.relationship('Tag', secondary=expense_tags, backref=db.backref('expenses', lazy='dynamic'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    role = db.Column(db.String(10), nullable=False)  # 'user' ou 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('chat_messages', lazy='dynamic'))

class NetworkingContact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(100))
    company = db.Column(db.String(100))
    linkedin_url = db.Column(db.String(200))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('networking_contacts', lazy='dynamic'))

class NetworkingPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    author_name = db.Column(db.String(100))
    content = db.Column(db.Text)
    linkedin_url = db.Column(db.String(200))
    likes_count = db.Column(db.Integer)
    comments_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('networking_posts', lazy=True))

class Goal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    deadline = db.Column(db.Date)
    status = db.Column(db.String(20), default='Em andamento')
    category = db.Column(db.String(20), nullable=False)  # 'alcancavel', 'mensuravel', 'relevante', 'temporal'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    progress = db.Column(db.Integer, default=0)
    timeframe = db.Column(db.String(20))
    aggression = db.Column(db.Integer)

    idea = db.relationship('Idea', backref=db.backref('goals', lazy='dynamic'))

class LegalStep(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    description = db.Column(db.Text, nullable=False)
    order = db.Column(db.Integer, nullable=False)
    progress = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('legal_steps', lazy='dynamic'))

class LegalConsultation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_user = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('legal_consultations', lazy='dynamic'))

class MarketResearch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('market_researches', lazy='dynamic'))

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    company = db.Column(db.String(100))
    category = db.Column(db.String(50))
    address = db.Column(db.String(200))
    notes = db.Column(db.Text)
    facebook = db.Column(db.String(200))
    instagram = db.Column(db.String(200))
    linkedin = db.Column(db.String(200))
    twitter = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    idea = db.relationship('Idea', backref=db.backref('customers', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'idea_id': self.idea_id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'company': self.company,
            'category': self.category,
            'address': self.address,
            'notes': self.notes,
            'facebook': self.facebook,
            'instagram': self.instagram,
            'linkedin': self.linkedin,
            'twitter': self.twitter,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
