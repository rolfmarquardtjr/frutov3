from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField, TextAreaField, SelectField
from wtforms.validators import ValidationError, DataRequired, Email, EqualTo, Length
from app.models import User

class LoginForm(FlaskForm):
    username = StringField('Nome de Usuário', validators=[DataRequired()])
    password = PasswordField('Senha', validators=[DataRequired()])
    remember_me = BooleanField('Lembrar-me')
    submit = SubmitField('Entrar')

class RegistrationForm(FlaskForm):
    username = StringField('Nome de Usuário', validators=[DataRequired()])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Senha', validators=[DataRequired()])
    password2 = PasswordField(
        'Repita a Senha', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Registrar')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Por favor, use um nome de usuário diferente.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Por favor, use um endereço de email diferente.')

class ProfileSettingsForm(FlaskForm):
    username = StringField('Nome de Usuário', validators=[DataRequired()])
    email = StringField('E-mail', validators=[DataRequired(), Email()])
    full_name = StringField('Nome Completo', validators=[DataRequired()])
    bio = TextAreaField('Biografia', validators=[Length(max=200)])
    
    email_for_sending = StringField('E-mail para Envio', validators=[DataRequired(), Email()])
    email_password = PasswordField('Senha do E-mail', validators=[DataRequired()])
    smtp_server = StringField('Servidor SMTP', validators=[DataRequired()])
    smtp_port = StringField('Porta SMTP', validators=[DataRequired()])
    
    language = SelectField('Idioma', choices=[('pt', 'Português'), ('en', 'English'), ('es', 'Español')])
    timezone = SelectField('Fuso Horário', choices=[('UTC-3', 'Brasília'), ('UTC-4', 'Manaus'), ('UTC-5', 'Rio Branco')])
    receive_notifications = BooleanField('Receber Notificações')
    
    current_password = PasswordField('Senha Atual')
    new_password = PasswordField('Nova Senha')
    confirm_new_password = PasswordField('Confirmar Nova Senha', validators=[EqualTo('new_password', message='As senhas devem coincidir')])
    
    submit = SubmitField('Salvar Configurações')

    def validate_username(self, username):
        if username.data != self.original_username:
            user = User.query.filter_by(username=username.data).first()
            if user is not None:
                raise ValidationError('Por favor, use um nome de usuário diferente.')

    def validate_email(self, email):
        if email.data != self.original_email:
            user = User.query.filter_by(email=email.data).first()
            if user is not None:
                raise ValidationError('Por favor, use um endereço de e-mail diferente.')
